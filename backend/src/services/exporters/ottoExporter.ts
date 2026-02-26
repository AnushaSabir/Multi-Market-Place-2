import { BaseExporter, ExportResult } from './baseExporter';

export class OttoExporter extends BaseExporter {
    marketplace: 'otto' = 'otto';

    protected async createListingOnApi(accessToken: string, product: any): Promise<ExportResult> {
        console.log(`[Otto] Creating listing: ${product.title}`);
        return {
            success: true,
            external_id: `OTTO-SKU-${Math.floor(Math.random() * 10000)}`
        };
    }

    protected async updateListingOnApi(accessToken: string, externalId: string, updates: any, credentials?: any): Promise<ExportResult> {
        console.log(`[Otto] Updating listing ${externalId}:`, updates);

        try {
            const axios = (await import('axios')).default;
            const sku = externalId;
            console.log(`[Otto] Official Update for SKU: ${sku}`);

            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            let errors = [];

            // 1. Update Price
            if (updates.price) {
                try {
                    const priceUrl = `https://api.otto.market/v5/products/prices`;
                    const pRes = await axios.post(priceUrl, [
                        {
                            sku: sku,
                            standardPrice: {
                                amount: updates.price,
                                currency: "EUR"
                            }
                        }
                    ], { headers });

                    console.log(`[Otto] Price API Response for ${sku}:`, JSON.stringify(pRes.data));
                    console.log(`[Otto] Price Updated Successfully for ${sku}`);
                } catch (pErr: any) {
                    const msg = pErr.response?.data ? JSON.stringify(pErr.response.data) : pErr.message;
                    console.error(`[Otto] Price Update Failed for ${sku}: ${msg}`);
                    errors.push(`Price: ${msg}`);
                }
            }

            // 2. Update Quantity
            if (updates.quantity !== undefined) {
                try {
                    // Reverting to v1 now that SKU is confirmed correct
                    const qtyUrl = `https://api.otto.market/v1/availability/quantities`;
                    const qtyBody = [
                        {
                            sku: sku,
                            quantity: updates.quantity
                        }
                    ];

                    console.log(`[Otto] Dispatching Quantity Update to V1:`, JSON.stringify(qtyBody));

                    const qRes = await axios.post(qtyUrl, qtyBody, { headers });

                    console.log(`[Otto] Quantity API Response for ${sku}:`, JSON.stringify(qRes.data));
                    console.log(`[Otto] Quantity Updated Successfully for ${sku}`);
                } catch (qErr: any) {
                    const msg = qErr.response?.data ? JSON.stringify(qErr.response.data) : qErr.message;
                    console.error(`[Otto] Quantity Update Failed for ${sku}: ${msg}`);
                    errors.push(`Qty: ${msg}`);
                }
            }

            if (errors.length > 0) {
                return { success: false, error: errors.join(" | ") };
            }
            return { success: true };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[Otto] Global Update Failed for SKU '${externalId}': ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
}
