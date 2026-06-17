import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';
import crypto from 'crypto';
import { OrderSyncService, ParsedOrder } from '../orderSyncService';
import { mapKauflandOrderState } from '../picklistEligibility';

export class KauflandImporter extends BaseImporter {
    marketplace: 'kaufland' = 'kaufland';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        console.log("Starting Unlimited Batch Import from Kaufland...");

        const secretKey = process.env.KAUFLAND_SECRET_KEY || '';
        if (!secretKey) {
            console.error("Kaufland Secret Key missing");
            throw new Error("Kaufland Secret Key missing");
        }

        let offset = 0;
        let limit = 50;
        let keepFetching = true;
        let totalSaved = 0;

        try {
            while (keepFetching) {
                console.log(`Fetching Kaufland products (Offset: ${offset})...`);

                const timestamp = Math.floor(Date.now() / 1000).toString();
                const method = 'GET';
                const listUrl = `https://sellerapi.kaufland.com/v2/units?limit=${limit}&offset=${offset}&storefront=de&embedded=products`;
                const body = ''; // GET request has no body

                // Generate Signature for THIS request
                const stringToSign = `${method}\n${listUrl}\n${body}\n${timestamp}`;
                const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

                const response: any = await axios.get(listUrl, {
                    headers: {
                        'Shop-Client-Key': accessToken,
                        'Shop-Timestamp': timestamp,
                        'Shop-Signature': signature,
                        'User-Agent': 'MultiMarketplaceApp/1.0',
                        'Accept': 'application/json'
                    }
                });

                const units = response.data.data || [];

                if (units.length === 0) {
                    console.log("No more items found on Kaufland.");
                    keepFetching = false;
                    break;
                }

                // Map and upsert immediately
                const pageProducts: ImportedProduct[] = units.map((u: any) => ({
                    title: u.product?.title || 'Unknown Kaufland Item',
                    description: u.product?.description || '',
                    sku: u.v_number || u.ean,
                    ean: u.ean || (u.product?.eans ? u.product.eans[0] : ''),
                    price: parseFloat(u.price || '0') / 100, // Price is in cents usually
                    quantity: parseInt(u.amount || '0'),
                    weight: 0,
                    images: u.product?.main_picture ? [u.product.main_picture] : (u.product?.picture ? [u.product.picture] : []),
                    external_id: u.id_unit.toString(),
                    marketplace: 'kaufland'
                }));

                for (const product of pageProducts) {
                    try {
                        await this.upsertProduct(product);
                        totalSaved++;
                    } catch (err: any) {
                        console.error(`Failed to save Kaufland item ${product.sku}:`, err.message);
                    }
                }

                console.log(`Offset ${offset} done. Total saved so far: ${totalSaved}`);

                if (units.length < limit) {
                    keepFetching = false;
                } else {
                    offset += limit;
                }
            }
        } catch (error: any) {
            console.error("Kaufland Fetch Critical Error:", error.response?.data || error.message);
            throw error;
        }

        console.log(`Kaufland Import Finished. Total successfully imported: ${totalSaved}`);

        return totalSaved;
    }

    public async importOrders(): Promise<{ success: boolean, count: number, error?: string }> {
        const clientKey = process.env.KAUFLAND_CLIENT_KEY || '';
        const secretKey = process.env.KAUFLAND_SECRET_KEY || '';
        if (!clientKey || !secretKey) {
            return { success: false, count: 0, error: "Missing Kaufland credentials" };
        }

        console.log(`[KauflandImporter] Fetching Kaufland orders...`);

        let offset = 0;
        const limit = 50;
        let keepFetching = true;
        let totalProcessed = 0;
        const openOrderNumbers = new Set<string>();

        try {
            while (keepFetching) {
                if (BaseImporter.stopImport) break;

                const timestamp = Math.floor(Date.now() / 1000).toString();
                const listUrl = `https://sellerapi.kaufland.com/v2/order-units?limit=${limit}&offset=${offset}&sort=ts_created:desc&status=need_to_be_sent&embedded=buyer,billing_address,shipping_address,product`;
                const stringToSign = `GET\n${listUrl}\n\n${timestamp}`;
                const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

                const response: any = await axios.get(listUrl, {
                    headers: {
                        'Shop-Client-Key': clientKey,
                        'Shop-Timestamp': timestamp,
                        'Shop-Signature': signature,
                        'User-Agent': 'MultiMarketplaceApp/1.0',
                        'Accept': 'application/json'
                    }
                });

                const units = response.data.data || [];
                
                // Group units by id_order to construct complete orders
                const ordersMap = new Map<string, any>();
                for (const unit of units) {
                    const orderId = unit.id_order;
                    if (!ordersMap.has(orderId)) {
                        ordersMap.set(orderId, {
                            id_order: orderId,
                            status: unit.status,
                            currency: unit.currency || 'EUR',
                            buyer: unit.buyer,
                            billing_address: unit.billing_address,
                            shipping_address: unit.shipping_address,
                            order_amount: 0,
                            order_units: []
                        });
                    }
                    const order = ordersMap.get(orderId);
                    order.order_amount += parseFloat(unit.price || '0');
                    order.order_units.push(unit);
                }

                const orders = Array.from(ordersMap.values());

                for (const order of orders) {
                    try {
                        openOrderNumbers.add(String(order.id_order));
                        const parsedOrder: ParsedOrder = {
                            order_number: order.id_order,
                            marketplace: 'kaufland',
                            created_at: order.order_units[0]?.ts_created_iso,
                            customer: {
                                email: order.billing_address?.email || order.buyer?.email || '',
                                first_name: order.billing_address?.first_name || '',
                                last_name: order.billing_address?.last_name || '',
                                phone: order.billing_address?.phone || ''
                            },
                            billing_address: {
                                first_name: order.billing_address?.first_name || '',
                                last_name: order.billing_address?.last_name || '',
                                company: order.billing_address?.company_name || '',
                                street: order.billing_address?.street || '',
                                house_number: order.billing_address?.house_number || '',
                                zip: order.billing_address?.postcode || '',
                                city: order.billing_address?.city || '',
                                country_code: order.billing_address?.country || ''
                            },
                            shipping_address: {
                                first_name: order.shipping_address?.first_name || '',
                                last_name: order.shipping_address?.last_name || '',
                                company: order.shipping_address?.company_name || '',
                                street: order.shipping_address?.street || '',
                                house_number: order.shipping_address?.house_number || '',
                                zip: order.shipping_address?.postcode || '',
                                city: order.shipping_address?.city || '',
                                country_code: order.shipping_address?.country || ''
                            },
                            state: mapKauflandOrderState(order.status),
                            total_price: order.order_amount / 100, // Converts cents to standard format
                            currency: order.currency,
                            items: order.order_units.map((unit: any) => ({
                                title: unit.id_offer || unit.product?.title || 'Kaufland Item',
                                sku: unit.id_offer || unit.product?.v_number || unit.product?.eans?.[0] || unit.ean || 'UNKNOWN',
                                quantity: 1, // Kaufland lists units individually
                                unit_price: parseFloat(unit.price || '0') / 100
                            }))
                        };

                        await OrderSyncService.upsertOrder(parsedOrder);
                        totalProcessed++;
                    } catch (e: any) {
                        console.error(`[KauflandImporter] Error syncing order ${order.id_order}:`, e.message);
                    }
                }

                if (units.length < limit) {
                    keepFetching = false;
                } else {
                    offset += limit;
                }
            }

            const hidden = await OrderSyncService.hideStaleOpenOrders('kaufland', openOrderNumbers);
            console.log(`[KauflandImporter] Hidden ${hidden} stale Kaufland orders from picklist.`);
            return { success: true, count: totalProcessed };
        } catch (error: any) {
            console.error("Kaufland Order Import Error:", error.response?.data || error.message);
            return { success: false, count: totalProcessed, error: error.message };
        }
    }
}
