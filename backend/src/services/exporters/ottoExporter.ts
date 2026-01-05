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
            const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

            // Otto typically uses 'Pricing' and 'Quantity' endpoints separated involved with Position Item ID or SKU
            // API: https://api.otto.market/v1/products/{sku}/pricing
            // API: https://api.otto.market/v1/products/{sku}/quantity

            // We assume externalId is the SKU based on our Importer logic, or we rely on updates.sku
            const sku = updates.sku || externalId;

            const promises = [];

            if (updates.price) {
                promises.push(axios.post(`https://api.otto.market/v1/products/${sku}/pricing`, {
                    standardPrice: {
                        amount: updates.price,
                        currency: "EUR"
                    }
                }, { headers }));
            }

            if (updates.quantity !== undefined) {
                promises.push(axios.post(`https://api.otto.market/v1/products/${sku}/quantity`, {
                    quantity: updates.quantity
                }, { headers }));
            }

            await Promise.all(promises);
            return { success: true };

        } catch (error: any) {
            console.error(`[Otto] Update Failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
