import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';
import dotenv from 'dotenv';
import { OrderSyncService } from '../orderSyncService';
import { isShopifyOrderImportable } from '../picklistEligibility';
dotenv.config();

export class ShopifyImporter extends BaseImporter {
    marketplace: 'shopify' = 'shopify';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        if (!shopDomain) throw new Error("SHOPIFY_SHOP_DOMAIN not set");

        console.log(`Fetching Shopify products from ${shopDomain}...`);

        let totalProcessed = 0;
        let url = `https://${shopDomain}/admin/api/2024-01/products.json?limit=250`;
        let pageCount = 1;

        try {
            while (url) {
                if (BaseImporter.stopImport) break;

                console.log(`[ShopifyImporter] Fetching page ${pageCount}... (Total: ${totalProcessed})`);
                const response = await axios.get(url, {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json'
                    }
                });

                const products = response.data.products;

                for (const p of products) {
                    const firstVariant = p.variants[0] || {};
                    const imageUrls = p.images?.map((img: any) => img.src) || [];

                    await this.upsertProduct({
                        title: p.title,
                        description: p.body_html?.replace(/<[^>]*>?/gm, "") || "",
                        sku: firstVariant.sku || `SHOPIFY-${p.id}`,
                        ean: firstVariant.barcode || "",
                        price: parseFloat(firstVariant.price || "0"),
                        quantity: firstVariant.inventory_quantity || 0,
                        images: imageUrls,
                        external_id: String(p.id),
                        marketplace: 'shopify'
                    });
                    totalProcessed++;
                }

                pageCount++;

                const linkHeader = response.headers['link'];
                if (linkHeader && linkHeader.includes('rel="next"')) {
                    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                    url = match ? match[1] : "";
                } else {
                    url = "";
                }
            }
        } catch (error: any) {
            console.error("Shopify Import Error:", error.response?.data || error.message);
            if (totalProcessed > 0) return totalProcessed;
            throw new Error(`Shopify API failed: ${error.message}`);
        }

        if (totalProcessed === 0) {
            throw new Error("Zero products found on Shopify. Verify your 'Shop Domain' and 'Access Token'.");
        }
        return totalProcessed;
    }

    public async importOrders(): Promise<{ success: boolean, count: number, error?: string }> {
        const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        
        if (!shopDomain || !accessToken) {
            return { success: false, count: 0, error: "Missing Shopify credentials" };
        }

        console.log(`[ShopifyImporter] Fetching Shopify orders from ${shopDomain}...`);

        let totalProcessed = 0;
        const since = new Date();
        since.setDate(since.getDate() - 1);
        let url = `https://${shopDomain}/admin/api/2024-01/orders.json?status=open&financial_status=paid&fulfillment_status=unfulfilled&limit=250&created_at_min=${encodeURIComponent(since.toISOString())}`;
        let pageCount = 1;

        try {
            while (url) {
                if (BaseImporter.stopImport) break;

                console.log(`[ShopifyImporter] Fetching orders page ${pageCount}...`);
                const response = await axios.get(url, {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                        'Content-Type': 'application/json'
                    }
                });

                const orders = response.data.orders || [];

                for (const order of orders) {
                    if (!isShopifyOrderImportable(order)) continue;

                    try {
                        await OrderSyncService.handleShopifyOrder(order);
                        totalProcessed++;
                    } catch (e: any) {
                        console.error(`[ShopifyImporter] Error syncing order ${order.id}:`, e.message);
                    }
                }

                pageCount++;
                const linkHeader = response.headers['link'];
                if (linkHeader && linkHeader.includes('rel="next"')) {
                    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                    url = match ? match[1] : "";
                } else {
                    url = "";
                }
            }
            return { success: true, count: totalProcessed };
        } catch (error: any) {
            console.error("Shopify Order Import Error:", error.response?.data || error.message);
            return { success: false, count: totalProcessed, error: error.message };
        }
    }
}
