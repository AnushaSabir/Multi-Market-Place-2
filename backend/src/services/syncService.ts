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

export class SyncService {

    // Called when Central Product is updated (Manual Price Change, etc)
    // "Central manual price overrides marketplace"
    static async syncProductUpdateToAll(productId: string, updates: {
        price?: number;
        quantity?: number;
        title?: string;
        description?: string;
        weight?: number;
        shipping_type?: string;
        images?: string[];
    }) {
        console.log(`Syncing product ${productId} updates to all connected marketplaces...`);

        // Find all connected marketplaces for this product
        const { data: links, error } = await supabase
            .from('marketplace_products')
            .select('marketplace')
            .eq('product_id', productId);

        if (error) {
            console.error("Error fetching links:", error);
            return;
        }

        if (!links || links.length === 0) return;

        // Push updates
        const promises = links.map(link => {
            const mp = link.marketplace as keyof typeof exporters;
            if (exporters[mp]) {
                return exporters[mp].updateProduct(productId, updates);
            }
            return Promise.resolve();
        });

        // Push updates safely - Using allSettled to ensure one failure doesn't stop others
        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Sync failed for link index ${index}:`, result.reason);
            }
        });
    }

    // Called via Webhook from Marketplace (Stock Sold, etc)
    // "Marketplace stock sale overrides central quantity"
    static async handleIncomingStockUpdate(marketplace: string, externalId: string, newQuantity: number) {
        console.log(`Received stock update from ${marketplace} for ${externalId}: ${newQuantity}`);

        // 1. Find Product ID
        const { data: link, error } = await supabase
            .from('marketplace_products')
            .select('product_id')
            .eq('marketplace', marketplace)
            .eq('external_id', externalId)
            .single();

        if (error || !link) {
            console.error(`Link not found for incoming update: ${marketplace} ${externalId}`);
            return;
        }

        const productId = link.product_id;

        // 2. Update Central Database
        // Note: We might want a check here to ensure we don't cause an infinite loop if we reflect this back?
        // Usually, we update central, and if central updates, it might trigger 'syncProductUpdateToAll'.
        // To prevent loop, passed updates should maybe have a 'source' flag, or we trust that 
        // updateProduct determines delta? 
        // For MVP, we will update Central, and then trigger sync to OTHER marketplaces, but NOT the source.

        const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', productId);

        if (updateError) {
            console.error("Failed to update central stock:", updateError);
            return;
        }

        // 3. Propagate to OTHER marketplaces
        // We get all links except the source
        const { data: allLinks } = await supabase
            .from('marketplace_products')
            .select('marketplace')
            .eq('product_id', productId)
            .neq('marketplace', marketplace); // Exclude source

        if (allLinks) {
            const promises = allLinks.map(l => {
                const mp = l.marketplace as keyof typeof exporters;
                if (exporters[mp]) {
                    return exporters[mp].updateProduct(productId, { quantity: newQuantity });
                }
                return Promise.resolve();
            });
            await Promise.all(promises);
        }
    }
}
