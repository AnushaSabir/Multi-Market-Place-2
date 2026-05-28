import { supabase } from '../database/supabaseClient';
import { ShopifyExporter } from './exporters/shopifyExporter';
import { EbayExporter } from './exporters/ebayExporter';
import { OttoExporter } from './exporters/ottoExporter';
import { KauflandExporter } from './exporters/kauflandExporter';

const exporters = {
    shopify: new ShopifyExporter(),
    ebay: new EbayExporter(),
    otto: new OttoExporter(),
    kaufland: new KauflandExporter()
};

export class RetryService {
    private static isRunning = false;

    static start(intervalMs: number = 5 * 60 * 1000) { // Default 5 minutes
        console.log(`[RetryService] Started with interval of ${intervalMs / 1000}s`);
        
        setInterval(async () => {
            if (this.isRunning) return;
            this.isRunning = true;
            
            try {
                await this.retryFailedSyncs();
            } catch (err) {
                console.error("[RetryService] Error during retry run:", err);
            } finally {
                this.isRunning = false;
            }
        }, intervalMs);
    }

    private static async retryFailedSyncs() {
        // Find products with sync_status = 'error'
        const { data: failedLinks, error } = await supabase
            .from('marketplace_products')
            .select('product_id, marketplace, price, quantity')
            .eq('sync_status', 'error');

        if (error) {
            console.error("[RetryService] Failed to fetch error products:", error.message);
            return;
        }

        if (!failedLinks || failedLinks.length === 0) {
            return; // Nothing to retry
        }

        console.log(`[RetryService] Found ${failedLinks.length} products to retry...`);

        for (const link of failedLinks) {
            const mp = link.marketplace as keyof typeof exporters;
            const productId = link.product_id;

            if (exporters[mp]) {
                console.log(`[RetryService] Retrying sync for Product: ${productId} on ${mp}`);
                try {
                    // Update sync_status to pending before trying
                    await supabase
                        .from('marketplace_products')
                        .update({ sync_status: 'pending' })
                        .eq('product_id', productId)
                        .eq('marketplace', mp);

                    // Fetch central product data just in case
                    const { data: centralProd } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', productId)
                        .single();

                    if (!centralProd) continue;

                    // Trigger updateProduct (it will handle pushing price/quantity)
                    const result = await exporters[mp].updateProduct(productId, centralProd);
                    
                    if (result.success) {
                        console.log(`[RetryService] SUCCESS for Product: ${productId} on ${mp}`);
                        // updateProduct already sets status to synced
                    } else {
                        console.log(`[RetryService] STILL FAILING for Product: ${productId} on ${mp}`);
                    }

                } catch (e: any) {
                    console.error(`[RetryService] Exception during retry for ${mp}:`, e.message);
                }
            }
            
            // Add a small delay between retries to avoid rate limits
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
