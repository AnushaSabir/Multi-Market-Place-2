import { supabase } from '../../database/supabaseClient';
import { TokenManger } from '../tokenService';

export interface ImportedProduct {
    title: string;
    description: string;
    sku: string;
    ean: string;
    price: number;
    quantity: number;
    weight?: number;
    images: string[];
    external_id: string;
    marketplace: 'otto' | 'ebay' | 'kaufland' | 'shopify';
}

export abstract class BaseImporter {
    abstract marketplace: 'otto' | 'ebay' | 'kaufland' | 'shopify';

    public static stopImport = false;
    public static isRunning = false;

    // Abstract method to specific marketplace API logic
    protected abstract fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number>;

    public async runImport(): Promise<{ success: boolean; count: number; error?: string }> {
        BaseImporter.stopImport = false; // Reset flag at start
        console.log(`Starting import for ${this.marketplace}...`);

        // Log start
        await this.logSync('import', 'pending');

        try {
            if (BaseImporter.stopImport) throw new Error("Import stopped by user");

            const token = await TokenManger.getAccessToken(this.marketplace);
            if (!token && process.env.NODE_ENV !== 'test') {
                console.warn(`No access token found for ${this.marketplace}. Depending on implementation, this might fail.`);
            }

            // Fetch
            const result = await this.fetchProductsFromApi(token || 'mock_token');

            let count = 0;
            if (typeof result === 'number') {
                count = result;
            } else {
                for (const item of result) {
                    await this.upsertProduct(item);
                    count++;
                }
            }

            await this.logSync('import', 'synced');
            return { success: true, count };

        } catch (err: any) {
            console.error(`Import failed for ${this.marketplace}:`, err);
            await this.logSync('import', 'failed', err.message);
            return { success: false, count: 0, error: err.message };
        } finally {
            BaseImporter.isRunning = false;
        }
    }

    protected async upsertProduct(item: ImportedProduct) {
        if (BaseImporter.stopImport) throw new Error("Import stopped by user");

        // 1. Check if product exists by EAN
        let productId: string | null = null;

        if (item.ean) {
            const { data: existing } = await supabase
                .from('products')
                .select('id')
                .eq('ean', item.ean)
                .single();

            if (existing) {
                productId = existing.id;
                console.log(`Product found for EAN ${item.ean}, merging...`);
            }
        }

        // 2. If not found by EAN, create new Product
        if (!productId) {
            // Fallback: check by specific marketplace ID link if we want strict linking? 
            // But req says "If same EAN exists -> merge".

            const { data: newProd, error } = await supabase
                .from('products')
                .insert({
                    title: item.title,
                    description: item.description,
                    sku: item.sku,
                    ean: item.ean,
                    price: item.price,
                    quantity: item.quantity,
                    weight: item.weight || 0,
                    images: item.images,
                    status: 'imported'
                })
                .select()
                .single();

            if (error) throw new Error(`Failed to create product: ${error.message}`);
            productId = newProd.id;
        } else {
            // Optional: Update existing product fields if newer? 
            // For now, we prefer not to overwrite "optimized" data with raw import unless empty.
            // We could fill in missing fields.
        }

        // 3. Update/Insert Marketplace Product Entry
        const { error: mpError } = await supabase
            .from('marketplace_products')
            .upsert({
                product_id: productId,
                marketplace: this.marketplace,
                external_id: item.external_id,
                price: item.price,
                quantity: item.quantity,
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced'
            }, { onConflict: 'product_id, marketplace' });

        if (mpError) throw new Error(`Failed to link marketplace product: ${mpError.message}`);
    }

    private async logSync(action: 'import' | 'export' | 'update', status: string, errorMsg?: string) {
        await supabase.from('sync_logs').insert({
            marketplace: this.marketplace,
            action,
            status,
            error_message: errorMsg
        });
    }
}
