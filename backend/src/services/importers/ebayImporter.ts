import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';
import { TokenManger } from '../tokenService';
import { OrderSyncService, ParsedOrder } from '../orderSyncService';
import { getPicklistCutoffDate } from '../picklistEligibility';

export class EbayImporter extends BaseImporter {
    marketplace: 'ebay' = 'ebay';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        // Searching for 'iphone' as a test. TODO: Change 'iphone' to your seller username filter like `q=...&filter=sellers:{USERNAME}`
        console.log(`Starting Unlimited Import from eBay (Seller: ${process.env.EBAY_SELLER_ID || 'All'})...`);

        // Use a wildcard '*' to match EVERYTHING from this seller.
        const sellerFilter = process.env.EBAY_SELLER_ID ? `&filter=sellers:{${process.env.EBAY_SELLER_ID}}` : '';
        // "q= " (space) is the standard way to match all items when filtering by seller
        let nextUrl: string | null = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=%20${sellerFilter}&limit=100`;

        let pageCount = 0;
        let totalSaved = 0;

        // ...

        try {
            while (nextUrl) {
                console.log(`Fetching eBay page ${pageCount + 1}...`);
                // Explicitly type response as any to avoid circular type inference issues
                const response: any = await axios.get(nextUrl!, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE' // Critical for German sellers!
                    }
                });

                const items = response.data.itemSummaries || [];
                if (items.length === 0) {
                    console.log("No more items found.");
                    break;
                }

                // Map and Save immediately (Batch Processing)
                if (items.length > 0) {
                    // Debug: Log the first item to see structure
                    console.log("Debug Item 1:", JSON.stringify(items[0], null, 2));
                    console.log("GTIN check:", items[0].gtin);
                }

                const pageProducts: ImportedProduct[] = items.map((item: any) => ({
                    title: item.product?.title || 'Unknown eBay Item',
                    description: item.product?.description || '',
                    sku: item.sku,
                    ean: item.product?.isbn || item.product?.upc || item.product?.ean || '',
                    price: 0, // Inventory API requires separate offer call for price
                    quantity: item.availability?.shipToLocationAvailability?.quantity || 0,
                    weight: 0,
                    images: item.product?.imageUrls || [],
                    external_id: item.sku,
                    marketplace: 'ebay'
                }));

                for (const product of pageProducts) {
                    try {
                        await this.upsertProduct(product);
                        totalSaved++;
                    } catch (err: any) {
                        console.error(`Failed to save item ${product.sku}:`, err.message);
                    }
                }


                // Pagination
                const nextLink = response.data.next;
                nextUrl = nextLink ? nextLink : null;

                // Fix: Ensure 'q' parameter exists in nextUrl if it was dropped
                if (nextUrl && !nextUrl.includes('q=')) {
                    nextUrl += '&q=%20';
                }

                pageCount++;
            }
        } catch (error: any) {
            // If we saved at least some items, we consider it a partial success
            if (totalSaved > 0) {
                console.warn("eBay Import stopped after partial success:", error.message);
                // Exit logic handled by returning empty array later
            }
            console.error("eBay Fetch Critical Error:", error.response?.data || error.message);
            throw error;
        }

        console.log(`eBay Import Finished. Total successfully imported: ${totalSaved}`);
        return totalSaved;
    }

    public async importOrders(): Promise<{ success: boolean, count: number, error?: string }> {
        const accessToken = await TokenManger.getAccessToken(this.marketplace); // Reusing the base method to get auth token
        if (!accessToken) {
            return { success: false, count: 0, error: "Missing eBay credentials or token" };
        }

        console.log(`[EbayImporter] Fetching eBay orders...`);

        let totalProcessed = 0;
        const filter = encodeURIComponent(`creationdate:[${getPicklistCutoffDate().toISOString()}..]`);
        let url: string | null = `https://api.ebay.com/sell/fulfillment/v1/order?limit=100&filter=${filter}`;

        try {
            while (url) {
                if (BaseImporter.stopImport) break;

                const response: any = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const orders = response.data.orders || [];

                for (const order of orders) {
                    try {
                        const parsedOrder: ParsedOrder = {
                            order_number: order.orderId,
                            marketplace: 'ebay',
                            created_at: order.creationDate || order.lastModifiedDate,
                            customer: {
                                email: order.buyer?.buyerRegistrationAddress?.email || `${order.buyer?.username || 'unknown'}@ebay.com`,
                                first_name: order.buyer?.buyerRegistrationAddress?.fullName?.split(' ')[0] || 'eBay',
                                last_name: order.buyer?.buyerRegistrationAddress?.fullName?.split(' ').slice(1).join(' ') || 'User'
                            },
                            shipping_address: {
                                first_name: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName?.split(' ')[0] || '',
                                last_name: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.fullName?.split(' ').slice(1).join(' ') || '',
                                street: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.addressLine1 || '',
                                house_number: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.addressLine2 || '',
                                zip: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.postalCode || '',
                                city: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.city || '',
                                country_code: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.countryCode || ''
                            },
                            state: order.orderFulfillmentStatus === 'FULFILLED' ? 'shipped' : order.orderPaymentStatus === 'PAID' ? 'paid' : 'pending',
                            total_price: parseFloat(order.pricingSummary?.total?.value || '0'),
                            currency: order.pricingSummary?.total?.currency || 'EUR',
                            items: (order.lineItems || []).map((item: any) => ({
                                title: item.title,
                                sku: item.sku,
                                quantity: item.quantity,
                                unit_price: parseFloat(item.lineItemCost?.value || '0')
                            }))
                        };

                        await OrderSyncService.upsertOrder(parsedOrder);
                        totalProcessed++;
                    } catch (e: any) {
                        console.error(`[EbayImporter] Error syncing order ${order.orderId}:`, e.message);
                    }
                }

                url = response.data.next ? response.data.next : null;
            }
            return { success: true, count: totalProcessed };
        } catch (error: any) {
            console.error("eBay Order Import Error:", error.response?.data || error.message);
            return { success: false, count: totalProcessed, error: error.message };
        }
    }
}
