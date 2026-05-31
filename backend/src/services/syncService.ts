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
        sku?: string;
    }) {
        console.log(`Syncing product ${productId} updates to all connected marketplaces...`);

        // Find all connected marketplaces for this product
        const { data: links, error } = await supabase
            .from('marketplace_products')
            .select('marketplace, external_id')
            .eq('product_id', productId);
            
        // Fetch SKU to assist Exporters (like eBay) that need SKU for updates
        const { data: centralProd } = await supabase
            .from('products')
            .select('sku')
            .eq('id', productId)
            .single();
        const productSku = centralProd?.sku;

        if (error) {
            console.error("Error fetching links:", error);
            return;
        }

        if (!links || links.length === 0) {
            console.log(`[SyncService] No connected marketplaces found for product ${productId}`);
            return;
        }

        console.log(`[SyncService] Found ${links.length} marketplaces: ${links.map(l => l.marketplace).join(', ')}`);

        // FIX: Disable syncing quantity from Master to Marketplaces (Marketplaces manage their own stock)
        if ('quantity' in updates) {
            delete updates.quantity;
        }

        // Fetch pricing rules if price is being updated
        let pricingRules: Record<string, { operator: string, value: number }> = {};
        if (updates.price !== undefined) {
            const { data: rulesData } = await supabase.from('marketplace_settings').select('*');
            if (rulesData) {
                rulesData.forEach(r => {
                    if (r.auto_price_rule) {
                        try {
                            pricingRules[r.marketplace] = JSON.parse(r.auto_price_rule);
                        } catch (e) {}
                    }
                });
            }
        }

        // Push updates
        const promises = links.map(async (link) => {
            const mp = link.marketplace as keyof typeof exporters;
            if (exporters[mp]) {
                console.log(`[SyncService] Dispatching update to ${mp}...`);
                
                // Clone updates to avoid mutating the shared object
                let mpUpdates = { ...updates };
                if (productSku && !mpUpdates.sku) {
                    mpUpdates.sku = productSku;
                }

                // Apply pricing rules if applicable
                if (mpUpdates.price !== undefined && pricingRules[mp]) {
                    const rule = pricingRules[mp];
                    let newPrice = mpUpdates.price;
                    if (rule.operator === '+') newPrice += rule.value;
                    else if (rule.operator === '-') newPrice -= rule.value;
                    else if (rule.operator === '+%') newPrice = newPrice + (newPrice * (rule.value / 100));
                    else if (rule.operator === '-%') newPrice = newPrice - (newPrice * (rule.value / 100));
                    
                    // Round to 2 decimal places
                    mpUpdates.price = Math.round(newPrice * 100) / 100;
                    console.log(`[SyncService] Applied rule to ${mp}: ${rule.operator}${rule.value}. New Price: ${mpUpdates.price}`);
                }

                return exporters[mp].updateProduct(productId, mpUpdates);
            }
            console.warn(`[SyncService] No exporter found for marketplace: ${mp}`);
            return Promise.resolve();
        });

        // Push updates safely - Using allSettled to ensure one failure doesn't stop others
        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            const mp = links[index].marketplace;
            if (result.status === 'rejected') {
                console.error(`[SyncService] Sync failed for ${mp}:`, result.reason);
            } else {
                console.log(`[SyncService] Sync process finished for ${mp}. Result Success: ${(result.value as any)?.success}`);
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

        // 1.5 Get current quantity to calculate change
        const { data: currentProduct } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', productId)
            .single();
        
        const oldQuantity = currentProduct?.quantity || 0;
        const change = newQuantity - oldQuantity;

        // 2. Update Central Database
        // Note: We update central, and then trigger sync to OTHER marketplaces, but NOT the source.
        const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', productId);

        if (updateError) {
            console.error("Failed to update central stock:", updateError);
            return;
        }

        // 2.5 Log movement
        if (change !== 0) {
            await supabase.from('stock_movements').insert({
                product_id: productId,
                change: change,
                current_stock: newQuantity,
                platform: marketplace.charAt(0).toUpperCase() + marketplace.slice(1),
                type: 'order',
                user_name: 'Webhook System'
            });
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
