import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';
import crypto from 'crypto';

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
            // Don't throw if we saved partial data
            if (totalSaved === 0) throw error;
        }

        console.log(`Kaufland Import Finished. Total successfully imported: ${totalSaved}`);

        if (totalSaved === 0) {
            throw new Error("Zero products found on Kaufland. Verify your 'Client Key' and 'Secret Key'.");
        }

        return totalSaved;
    }
}
