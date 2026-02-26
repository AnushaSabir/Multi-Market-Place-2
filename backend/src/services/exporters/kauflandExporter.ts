import { BaseExporter, ExportResult } from './baseExporter';

export class KauflandExporter extends BaseExporter {
    marketplace: 'kaufland' = 'kaufland';

    protected async createListingOnApi(accessToken: string, product: any): Promise<ExportResult> {
        console.log(`[Kaufland] Creating unit for SKU: ${product.sku} (EAN: ${product.ean})`);

        try {
            const axios = (await import('axios')).default;
            const crypto = (await import('crypto')).default;
            const secretKey = process.env.KAUFLAND_SECRET_KEY || '';

            if (!product.ean) {
                return { success: false, error: "EAN is required for Kaufland listing" };
            }

            const body = {
                ean: product.ean,
                condition: 'NEW',
                listing_price: Math.round(product.price * 100),
                amount: product.quantity || 0,
                id_offer: product.sku,
                delivery_time_min: 1,
                delivery_time_max: 3
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const url = `https://sellerapi.kaufland.com/v2/units?storefront=de`;
            const method = 'POST';
            const bodyStr = JSON.stringify(body);
            const stringToSign = `${method}\n${url}\n${bodyStr}\n${timestamp}`;
            const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

            const response = await axios.post(url, bodyStr, {
                headers: {
                    'Shop-Client-Key': accessToken,
                    'Shop-Timestamp': timestamp,
                    'Shop-Signature': signature,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                external_id: response.data.id_unit?.toString() || product.sku
            };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[Kaufland] Creation Failed: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    protected async updateListingOnApi(accessToken: string, externalId: string, updates: any, credentials?: any): Promise<ExportResult> {
        console.log(`[Kaufland] Updating listing ${externalId}:`, JSON.stringify(updates));

        try {
            const axios = (await import('axios')).default;
            const crypto = (await import('crypto')).default;

            // Prioritize secret key from credentials (DB), fallback to .env
            const secretKey = credentials?.secret_key || process.env.KAUFLAND_SECRET_KEY || '';

            if (!secretKey) {
                console.error("[Kaufland] Secret Key missing for signature");
                return { success: false, error: "Secret Key missing" };
            }

            const body: any = {};
            if (updates.price) body.listing_price = Math.round(updates.price * 100);
            if (updates.quantity !== undefined) body.amount = updates.quantity;

            if (Object.keys(body).length > 0) {
                const timestamp = Math.floor(Date.now() / 1000).toString();
                // Storefront is required even for PATCH
                const url = `https://sellerapi.kaufland.com/v2/units/${externalId}?storefront=de`;
                const method = 'PATCH';

                // Stability: Stringify first, then use that string for both signature and request
                const finalBodyStr = JSON.stringify(body);

                // Signature logic: method\nfullUrl\nbody\ntimestamp
                const stringToSign = `${method}\n${url}\n${finalBodyStr}\n${timestamp}`;
                const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

                console.log(`[Kaufland] PATCH URL: ${url}`);
                console.log(`[Kaufland] PATCH Body: ${finalBodyStr}`);
                console.log(`[Kaufland] Sig Base: ${stringToSign.replace(/\n/g, '\\n')}`);

                const response = await axios.patch(url, finalBodyStr, {
                    headers: {
                        'Shop-Client-Key': accessToken,
                        'Shop-Timestamp': timestamp,
                        'Shop-Signature': signature,
                        'Content-Type': 'application/json',
                        'User-Agent': 'EpicTec/1.0',
                        'Accept': 'application/json'
                    }
                });
                console.log(`[Kaufland] API Response for ${externalId}:`, JSON.stringify(response.data));
            }

            return { success: true };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[Kaufland] Update Failed for ${externalId}: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
}
