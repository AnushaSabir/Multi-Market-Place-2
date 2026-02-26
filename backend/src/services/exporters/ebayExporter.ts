import { BaseExporter, ExportResult } from './baseExporter';

export class EbayExporter extends BaseExporter {
    marketplace: 'ebay' = 'ebay';

    protected async createListingOnApi(accessToken: string, product: any): Promise<ExportResult> {
        console.log(`[eBay] Creating listing for SKU: ${product.sku}`);

        try {
            const axios = (await import('axios')).default;
            const sku = product.sku;

            // 1. Create or Replace Inventory Item
            const inventoryUrl = `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`;
            const inventoryBody = {
                availability: {
                    shipToLocationAvailability: { quantity: product.quantity || 0 }
                },
                condition: 'NEW',
                product: {
                    title: product.title,
                    description: product.description,
                    imageUrls: product.images || []
                }
            };

            await axios.put(inventoryUrl, inventoryBody, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'de-DE'
                }
            });

            // 2. Create Offer
            const offerUrl = 'https://api.ebay.com/sell/inventory/v1/offer';
            const offerBody = {
                sku: sku,
                marketplaceId: 'EBAY_DE',
                format: 'FIXED_PRICE',
                availableQuantity: product.quantity || 0,
                categoryId: '1', // Default category, user might need to mapping this
                listingDescription: product.description,
                listingPolicies: {
                    fulfillmentPolicyId: 'POLICY_ID', // Placeholder, needs actual policy IDs
                    paymentPolicyId: 'POLICY_ID',
                    returnPolicyId: 'POLICY_ID'
                },
                pricingSummary: {
                    price: { value: product.price.toString(), currency: 'EUR' }
                },
                merchantLocationKey: 'MAIN_WAREHOUSE' // Placeholder
            };

            const offerResponse = await axios.post(offerUrl, offerBody, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Content-Language': 'de-DE'
                }
            });

            const offerId = offerResponse.data.offerId;

            // Note: We don't automatically "Publish" here to give users control, 
            // or we could publish if requested. For now, returning offerId as externalId.
            return {
                success: true,
                external_id: offerId
            };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[eBay] Creation Failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    protected async updateListingOnApi(accessToken: string, externalId: string, updates: any, credentials?: any): Promise<ExportResult> {
        console.log(`[eBay] Updating listing ${externalId}...`);

        try {
            const axios = (await import('axios')).default;
            // Use local SKU if provided, fallback to externalId (Listing ID)
            const sku = updates.sku || externalId;

            const body = {
                requests: [
                    {
                        sku: sku,
                        ...(updates.price ? {
                            offers: [{
                                price: { value: updates.price.toString(), currency: "EUR" }
                            }]
                        } : {}),
                        ...(updates.quantity !== undefined ? {
                            shipToLocationAvailability: { quantity: updates.quantity }
                        } : {})
                    }
                ]
            };

            const response = await axios.post(
                'https://api.ebay.com/sell/inventory/v1/bulk_update_price_quantity',
                body,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE' // Often required for German sellers
                    }
                }
            );

            console.log(`[eBay] API Response for ${sku}:`, JSON.stringify(response.data));

            // eBay bulk API returns 200 even if individual requests failed
            const individualResponse = response.data.responses?.[0];
            if (individualResponse && individualResponse.statusCode >= 400) {
                console.error(`[eBay] Update failed for SKU ${sku}:`, JSON.stringify(individualResponse.errors));
                const firstError = individualResponse.errors?.[0]?.message || "Individual update failed";
                return { success: false, error: firstError };
            }

            console.log(`[eBay] Update successful for SKU: ${sku}`);
            return { success: true };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[eBay] Update Failed for ${externalId}: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
}
