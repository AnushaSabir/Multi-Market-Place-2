import { BaseExporter, ExportResult } from './baseExporter';

export class ShopifyExporter extends BaseExporter {
    marketplace: 'shopify' = 'shopify';

    protected async createListingOnApi(accessToken: string, product: any): Promise<ExportResult> {
        console.log(`[Shopify] Creating product: ${product.title}`);
        // Mock API Call to Spotify
        // POST https://your-shop.myshopify.com/admin/api/2023-04/products.json

        return {
            success: true,
            external_id: `SHOP-${Math.floor(Math.random() * 10000)}`
        };
    }

    protected async updateListingOnApi(accessToken: string, externalId: string, updates: any): Promise<ExportResult> {
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        console.log(`[Shopify] Updating product ${externalId} on ${shopDomain}...`);

        try {
            const body: any = { product: { id: externalId } };

            if (updates.title) body.product.title = updates.title;
            if (updates.description) body.product.body_html = updates.description;
            // Variants update for Price/Stock/SKU/Weight
            // Limitation: Updates ALL variants to same price/stock for simplicity in MVP
            if (updates.price || updates.quantity || updates.sku || updates.weight) {
                // Fetch to get variant IDs first? Or just try updating main product variants?
                // Shopify requires Variant ID to update specific variant. 
                // For MVP, we assume single variant or we just update the top level fields if allowed.
                // Better approach: fetch product, get variant IDs, update them.

                // Fetching first to get variant ID
                const getUrl = `https://${shopDomain}/admin/api/2024-01/products/${externalId}.json`;
                const getRes = await import('axios').then(a => a.default.get(getUrl, { headers: { 'X-Shopify-Access-Token': accessToken } }));
                const variantId = getRes.data.product.variants[0]?.id;

                if (variantId) {
                    body.product.variants = [{
                        id: variantId,
                        price: updates.price ? String(updates.price) : undefined,
                        inventory_quantity: updates.quantity, // Note: Inventory needs separate endpoint usually, but simple update might work for non-tracked
                        sku: updates.sku,
                        weight: updates.weight,
                        weight_unit: 'kg'
                    }];
                }
            }

            if (updates.images) {
                // Shopify expects images: [{ src: "url" }, ...]
                // This replaces ALL images
                body.product.images = updates.images.map((url: string) => ({ src: url }));
            }

            if (updates.shipping_type) {
                // Map Shipping Type to a Tag for visibility
                body.product.tags = updates.shipping_type;
            }

            const url = `https://${shopDomain}/admin/api/2024-01/products/${externalId}.json`;
            await import('axios').then(a => a.default.put(url, body, {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                }
            }));

            return { success: true };
        } catch (error: any) {
            console.error(`[Shopify] Update Failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
