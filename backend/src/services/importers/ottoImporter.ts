import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';
import { TokenManger } from '../tokenService';
import { OrderSyncService, ParsedOrder } from '../orderSyncService';
import { getPicklistCutoffDate, mapOttoOrderState } from '../picklistEligibility';

export class OttoImporter extends BaseImporter {
    marketplace: 'otto' = 'otto';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        console.log("Fetching all products from Otto API...");

        let allProducts: ImportedProduct[] = [];
        const isSandbox = process.env.OTTO_ENV === 'sandbox';
        const baseUrl = isSandbox ? 'https://sandbox.api.otto.market' : 'https://api.otto.market';
        let nextUrl: string | null = `${baseUrl}/v5/products?limit=50`;
        let pageCount = 0;
        const MAX_PAGES = 1000;
        let totalProcessed = 0;

        try {
            while (nextUrl && pageCount < MAX_PAGES) {
                if (BaseImporter.stopImport) throw new Error("Import stopped by user");
                console.log(`Fetching page ${pageCount + 1}...`);

                // Add a small delay between pages to prevent overloading Otto API
                if (pageCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }

                const response: any = await axios.get(nextUrl!, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    timeout: 45000 // Increase timeout to 45 seconds for large pages
                });

                let productsRaw = [];
                if (Array.isArray(response.data)) {
                    productsRaw = response.data;
                } else if (response.data.productVariations && Array.isArray(response.data.productVariations)) {
                    productsRaw = response.data.productVariations;
                } else if (response.data.resources && Array.isArray(response.data.resources)) {
                    productsRaw = response.data.resources;
                }

                if (productsRaw.length === 0) {
                    console.log("No more products found on this page.");
                    break;
                }

                const pageProducts = productsRaw.map((p: any) => {
                    const actualSku = p.sku || p.partnerSku || p.productReference;
                    return {
                        title: p.productName || p.productReference || 'Unknown Title',
                        description: p.productDescription?.description || p.description || '',
                        sku: actualSku,
                        ean: p.ean || p.gtin || '',
                        price: parseFloat(p.pricing?.standardPrice?.amount || p.price || '0'),
                        quantity: parseInt(p.stock?.quantity || p.quantity || '0'),
                        images: p.mediaAssets?.map((m: any) => m.location) || [],
                        external_id: actualSku, // Ensure external_id is the SKU, not the title
                        marketplace: 'otto'
                    };
                });

                for (const prod of pageProducts) {
                    await this.upsertProduct(prod as ImportedProduct);
                    totalProcessed++;
                }

                console.log(`Page ${pageCount + 1} processed. Total items: ${totalProcessed}`);

                const links: any = response.data.links || response.data._links;
                const nextLink: any = Array.isArray(links) ? links.find((l: any) => l.rel === 'next') : (links?.next || null);

                if (nextLink && nextLink.href) {
                    let href = nextLink.href;
                    if (!href.startsWith('http')) {
                        href = href.startsWith('/') ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
                    }
                    nextUrl = href;
                } else {
                    nextUrl = null;
                }

                pageCount++;
            }
        } catch (error: any) {
            console.error("Otto Fetch Error:", error.response?.data || error.message);
            if (totalProcessed > 0) return totalProcessed;
            throw error;
        }

        console.log(`Total Otto products imported: ${totalProcessed}`);
        return totalProcessed;
    }

    public async importOrders(): Promise<{ success: boolean, count: number, error?: string }> {
        const accessToken = await TokenManger.getAccessToken(this.marketplace); // Reusing the base method to get auth token
        if (!accessToken) {
            return { success: false, count: 0, error: "Missing Otto credentials or token" };
        }

        console.log(`[OttoImporter] Fetching Otto orders...`);

        let totalProcessed = 0;
        const isSandbox = process.env.OTTO_ENV === 'sandbox';
        const baseUrl = isSandbox ? 'https://sandbox.api.otto.market' : 'https://api.otto.market';
        const fromDate = getPicklistCutoffDate().toISOString();
        let url: string | null = `${baseUrl}/v4/orders?limit=100&fromDate=${encodeURIComponent(fromDate)}`;
        let pageCount = 1;

        try {
            while (url) {
                if (BaseImporter.stopImport) break;

                console.log(`[OttoImporter] Fetching orders page ${pageCount}...`);
                const response: any = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                const orders = response.data.resources || response.data || [];

                for (const order of orders) {
                    try {
                        const parsedOrder: ParsedOrder = {
                            order_number: order.orderNumber || order.salesOrderId,
                            marketplace: 'otto',
                            created_at: order.orderDate || order.createdAt || order.createdDate,
                            customer: {
                                email: order.customer?.email || order.deliveryAddress?.email || '',
                                first_name: order.deliveryAddress?.firstName || order.invoiceAddress?.firstName || '',
                                last_name: order.deliveryAddress?.lastName || order.invoiceAddress?.lastName || '',
                                phone: order.deliveryAddress?.phoneNumber || ''
                            },
                            billing_address: {
                                first_name: order.invoiceAddress?.firstName || '',
                                last_name: order.invoiceAddress?.lastName || '',
                                company: order.invoiceAddress?.companyName || '',
                                street: order.invoiceAddress?.street || '',
                                house_number: order.invoiceAddress?.houseNumber || '',
                                zip: order.invoiceAddress?.zipCode || '',
                                city: order.invoiceAddress?.city || '',
                                country_code: order.invoiceAddress?.countryCode || ''
                            },
                            shipping_address: {
                                first_name: order.deliveryAddress?.firstName || '',
                                last_name: order.deliveryAddress?.lastName || '',
                                company: order.deliveryAddress?.companyName || '',
                                street: order.deliveryAddress?.street || '',
                                house_number: order.deliveryAddress?.houseNumber || '',
                                zip: order.deliveryAddress?.zipCode || '',
                                city: order.deliveryAddress?.city || '',
                                country_code: order.deliveryAddress?.countryCode || ''
                            },
                            state: mapOttoOrderState(order.orderLifecycleStatus || order.status || order.state),
                            total_price: parseFloat(order.amount?.amount || order.totalAmount || '0'),
                            currency: order.amount?.currency || 'EUR',
                            items: (order.positionItems || order.lineItems || []).map((item: any) => ({
                                title: item.productTitle || item.title || 'Otto Item',
                                sku: item.partnerSku || item.sku || 'UNKNOWN',
                                quantity: item.quantity || 1,
                                unit_price: parseFloat(item.itemPrice?.amount || item.price || '0')
                            }))
                        };

                        await OrderSyncService.upsertOrder(parsedOrder);
                        totalProcessed++;
                    } catch (e: any) {
                        console.error(`[OttoImporter] Error syncing order ${order.orderNumber}:`, e.message);
                    }
                }

                pageCount++;
                const links: any = response.data.links || response.data._links;
                const nextLink: any = Array.isArray(links) ? links.find((l: any) => l.rel === 'next') : (links?.next || null);

                if (nextLink && nextLink.href) {
                    let href = nextLink.href;
                    if (!href.startsWith('http')) {
                        href = href.startsWith('/') ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
                    }
                    url = href;
                } else {
                    url = null;
                }
            }
            return { success: true, count: totalProcessed };
        } catch (error: any) {
            console.error("Otto Order Import Error:", error.response?.data || error.message);
            return { success: false, count: totalProcessed, error: error.message };
        }
    }
}
