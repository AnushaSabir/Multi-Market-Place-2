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

            // 1. Send Product Data (Title, Description, Image, Manufacturer)
            const productDataBody = {
                attributes: {
                    title: [product.title || `Product ${product.ean}`],
                    description: [product.description || product.title || `Description for ${product.ean}`],
                    picture: product.images && product.images.length > 0 ? product.images : [],
                    manufacturer: [product.brand || "VIVITAR"] // Fixed: Use VIVITAR as default to prevent blocks
                }
            };
            const pdTimestamp = Math.floor(Date.now() / 1000).toString();
            const pdUrl = `https://sellerapi.kaufland.com/v2/product-data/${product.ean}`;
            const pdMethod = 'PUT';
            const pdBodyStr = JSON.stringify(productDataBody);
            const pdStringToSign = `${pdMethod}\n${pdUrl}\n${pdBodyStr}\n${pdTimestamp}`;
            const pdSignature = crypto.createHmac('sha256', secretKey).update(pdStringToSign).digest('hex');

            try {
                await axios.put(pdUrl, pdBodyStr, {
                    headers: {
                        'Shop-Client-Key': accessToken,
                        'Shop-Timestamp': pdTimestamp,
                        'Shop-Signature': pdSignature,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`[Kaufland] Product data pushed for EAN: ${product.ean}`);
            } catch (pdError: any) {
                console.warn(`[Kaufland] Product data push warning for EAN: ${product.ean}. Details:`, pdError.response?.data || pdError.message);
                // We continue even if product data fails, as the unit might still be created if the EAN already exists in Kaufland's catalog.
            }

            // 2. Create the Unit (Offer)
            const body = {
                ean: product.ean,
                condition: 'NEW',
                listing_price: Math.round(product.price * 100),
                amount: product.quantity || 0,
                id_offer: product.sku,
                handling_time: 2
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
                external_id: response.data?.data?.id_unit?.toString() || response.data?.id_unit?.toString() || product.sku
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

            // 1. Push Product Data (Images, Title, Description) if EAN is available
            const cleanImages = Array.isArray(updates.images) ? updates.images.filter(Boolean) : [];
            if (updates.ean && (updates.title || updates.description || cleanImages.length > 0)) {
                const productDataBody = {
                    attributes: {
                        ...(updates.title ? { title: [updates.title] } : {}),
                        ...(updates.description ? { description: [updates.description] } : {}),
                        ...(cleanImages.length > 0 ? { picture: cleanImages } : {}),
                        manufacturer: ["VIVITAR"]
                    }
                };
                
                const pdTimestamp = Math.floor(Date.now() / 1000).toString();
                const pdUrl = `https://sellerapi.kaufland.com/v2/product-data/${updates.ean}`;
                const pdMethod = 'PUT';
                const pdBodyStr = JSON.stringify(productDataBody);
                const pdStringToSign = `${pdMethod}\n${pdUrl}\n${pdBodyStr}\n${pdTimestamp}`;
                const pdSignature = crypto.createHmac('sha256', secretKey).update(pdStringToSign).digest('hex');

                try {
                    await axios.put(pdUrl, pdBodyStr, {
                        headers: {
                            'Shop-Client-Key': accessToken,
                            'Shop-Timestamp': pdTimestamp,
                            'Shop-Signature': pdSignature,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log(`[Kaufland] Product data updated for EAN: ${updates.ean}`);
                } catch (pdError: any) {
                    console.warn(`[Kaufland] Product data update warning for EAN: ${updates.ean}. Details:`, pdError.response?.data || pdError.message);
                }
            }

            const body: any = {};
            if (updates.price !== undefined) body.listing_price = Math.round(updates.price * 100);
            if (updates.quantity !== undefined) body.amount = updates.quantity;

            if (Object.keys(body).length > 0) {
                // 2. Fetch all units for this EAN to ensure we update the active one as well
                let unitIdsToUpdate = [externalId];
                
                if (updates.ean) {
                    try {
                        const getTimestamp = Math.floor(Date.now() / 1000).toString();
                        const getUrl = `https://sellerapi.kaufland.com/v2/units?ean=${updates.ean}&storefront=de`;
                        const getMethod = 'GET';
                        const getStringToSign = `${getMethod}\n${getUrl}\n\n${getTimestamp}`;
                        const getSignature = crypto.createHmac('sha256', secretKey).update(getStringToSign).digest('hex');
                        
                        const getRes = await axios.get(getUrl, {
                            headers: {
                                'Shop-Client-Key': accessToken,
                                'Shop-Timestamp': getTimestamp,
                                'Shop-Signature': getSignature,
                                'Accept': 'application/json'
                            }
                        });
                        
                        if (getRes.data && getRes.data.data && Array.isArray(getRes.data.data)) {
                            // Collect all unit IDs for this EAN to update them all
                            const allIds = getRes.data.data.map((u: any) => u.id_unit.toString());
                            if (allIds.length > 0) {
                                unitIdsToUpdate = Array.from(new Set([...unitIdsToUpdate, ...allIds]));
                            }
                        }
                    } catch (getError: any) {
                        console.warn(`[Kaufland] Failed to fetch all units for EAN ${updates.ean}:`, getError.message);
                    }
                }
                
                // 3. Update all collected units
                const patchErrors: string[] = [];
                let patchedCount = 0;
                for (const uid of unitIdsToUpdate) {
                    try {
                        const timestamp = Math.floor(Date.now() / 1000).toString();
                        const url = `https://sellerapi.kaufland.com/v2/units/${uid}?storefront=de`;
                        const method = 'PATCH';
                        const finalBodyStr = JSON.stringify(body);
                        const stringToSign = `${method}\n${url}\n${finalBodyStr}\n${timestamp}`;
                        const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

                        await axios.patch(url, finalBodyStr, {
                            headers: {
                                'Shop-Client-Key': accessToken,
                                'Shop-Timestamp': timestamp,
                                'Shop-Signature': signature,
                                'Content-Type': 'application/json',
                                'User-Agent': 'EpicTec/1.0',
                                'Accept': 'application/json'
                            }
                        });
                        console.log(`[Kaufland] Successfully patched unit ${uid}`);
                        patchedCount++;
                    } catch (patchErr: any) {
                        const msg = patchErr.response?.data ? JSON.stringify(patchErr.response.data) : patchErr.message;
                        patchErrors.push(`${uid}: ${msg}`);
                        console.warn(`[Kaufland] Failed to patch unit ${uid}:`, patchErr.response?.data || patchErr.message);
                    }
                }

                if (patchedCount === 0 && patchErrors.length > 0) {
                    return { success: false, error: `No Kaufland units were updated. ${patchErrors.join(' | ')}` };
                }
            }

            return { success: true };

        } catch (error: any) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[Kaufland] Update Failed for ${externalId}: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
}
