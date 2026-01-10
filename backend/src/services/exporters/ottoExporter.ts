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

    protected async updateListingOnApi(accessToken: string, externalId: string, updates: any): Promise<ExportResult> {
        console.log(`[Otto] Updating listing ${externalId}:`, updates);

        try {
            const axios = (await import('axios')).default;
            console.log(`[Otto] Using Token (start): ${accessToken.substring(0, 10)}...`);
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Otto typically uses 'Pricing' and 'Quantity' endpoints separated involved with Position Item ID or SKU
            // API: https://api.otto.market/v1/products/{sku}/pricing
            // API: https://api.otto.market/v1/products/{sku}/quantity

            // We assume externalId is the SKU based on our Importer logic, or we rely on updates.sku
            const sku = updates.sku || externalId;

            const promises = [];

            // Ensure SKU is URL encoded to handle spaces/special chars
            const safeSku = encodeURIComponent(sku);
            let errors = [];

            // 1. Update Price
            if (updates.price) {
                try {
                    const priceUrl = `https://api.otto.market/v5/products/prices`;
                    console.log(`[Otto] Posting Price to: ${priceUrl}`);
                    await axios.post(priceUrl, [
                        {
                            sku: sku,
                            standardPrice: {
                                amount: updates.price,
                                currency: "EUR"
                            }
                        }
                    ], { headers });
                    console.log(`[Otto] Price Updated Successfully`);
                } catch (pErr: any) {
                    const msg = pErr.response?.data ? JSON.stringify(pErr.response.data) : pErr.message;
                    console.error(`[Otto] Price Update Failed: ${msg}`);
                    errors.push(`Price: ${msg}`);
                }
            }

            // 2. Update Quantity (Availability V1)
            if (updates.quantity !== undefined) {
                try {
                    const qtyUrl = `https://api.otto.market/v1/availability/quantities`;
                    console.log(`[Otto] Posting Quantity to: ${qtyUrl}`);
                    await axios.post(qtyUrl, [
                        {
                            sku: sku, // Raw SKU for body
                            quantity: updates.quantity
                        }
                    ], { headers });
                    console.log(`[Otto] Quantity Updated Successfully`);
                } catch (qErr: any) {
                    const msg = qErr.response?.data ? JSON.stringify(qErr.response.data) : qErr.message;
                    console.error(`[Otto] Quantity Update Failed: ${msg}`);
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
