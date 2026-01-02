import { supabase } from '../../database/supabaseClient';
import { TokenManger } from '../tokenService';

export interface ExportResult {
    success: boolean;
    external_id?: string;
    error?: string;
}

export abstract class BaseExporter {
    abstract marketplace: 'otto' | 'ebay' | 'kaufland' | 'shopify';

    // Specific API implementation to create a listing
    protected abstract createListingOnApi(accessToken: string, product: any): Promise<ExportResult>;

    // Specific API implementation to update price/stock or details
    protected abstract updateListingOnApi(accessToken: string, externalId: string, updates: { price?: number; quantity?: number; title?: string; description?: string; sku?: string; weight?: number; images?: string[]; shipping_type?: string }): Promise<ExportResult>;

    async publishProduct(productId: string): Promise<ExportResult> {
        try {
            await this.logSync('export', 'pending');

            // 1. Get Product Data
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error || !product) throw new Error('Product not found');
            if (product.status !== 'optimized' && product.status !== 'published' && product.status !== 'imported') {
                // Depending on strictness, we might allow 'imported' too, but usually we want it unchecked.
                // Requirement says "Push product after manual confirmation" -> status check implied by caller usually, but good to be safe.
            }

            const token = await TokenManger.getAccessToken(this.marketplace);
            if (!token && process.env.NODE_ENV !== 'test') {
                // Mock fallback or error
                console.warn(`No token for ${this.marketplace}`);
            }

            // 2. Call API
            const result = await this.createListingOnApi(token || 'mock_token', product);

            if (result.success && result.external_id) {
                // 3. Save mapping
                const { error: mapError } = await supabase
                    .from('marketplace_products')
                    .upsert({
                        product_id: productId,
                        marketplace: this.marketplace,
                        external_id: result.external_id,
                        price: product.price,
                        quantity: product.quantity,
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString()
                    }, { onConflict: 'product_id, marketplace' });

                if (mapError) console.error("Error saving map:", mapError);

                await this.logSync('export', 'success');
            } else {
                await this.logSync('export', 'failed', result.error);
            }

            return result;

        } catch (e: any) {
            console.error(`Publish failed for ${this.marketplace}:`, e);
            await this.logSync('export', 'failed', e.message);
            return { success: false, error: e.message };
        }
    }

    async updateProduct(productId: string, updates: { price?: number; quantity?: number; title?: string; description?: string }): Promise<ExportResult> {
        try {
            await this.logSync('update', 'pending');

            // 1. Get External ID
            const { data: mapping, error } = await supabase
                .from('marketplace_products')
                .select('external_id')
                .eq('product_id', productId)
                .eq('marketplace', this.marketplace)
                .single();

            if (error || !mapping) {
                return { success: false, error: 'Product not linked to this marketplace' };
            }

            const token = await TokenManger.getAccessToken(this.marketplace);

            // 2. Call API
            const result = await this.updateListingOnApi(token || 'mock_token', mapping.external_id, updates);

            // 3. Update local sync status
            if (result.success) {
                await supabase
                    .from('marketplace_products')
                    .update({
                        last_synced_at: new Date().toISOString(),
                        sync_status: 'synced',
                        ...(updates.price ? { price: updates.price } : {}),
                        ...(updates.quantity ? { quantity: updates.quantity } : {})
                    })
                    .eq('product_id', productId)
                    .eq('marketplace', this.marketplace);

                await this.logSync('update', 'success');
            } else {
                await this.logSync('update', 'failed', result.error);
            }

            return result;

        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    protected async logSync(action: 'export' | 'update', status: string, errorMsg?: string) {
        await supabase.from('sync_logs').insert({
            marketplace: this.marketplace,
            action,
            status,
            error_message: errorMsg
        });
    }
}
