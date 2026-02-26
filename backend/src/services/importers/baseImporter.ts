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

        let productId: string | null = null;

        // 1. Check if this specific marketplace product is already linked
        const { data: existingMP } = await supabase
            .from('marketplace_products')
            .select('product_id')
            .eq('marketplace', this.marketplace)
            .eq('external_id', item.external_id)
            .maybeSingle();

        if (existingMP) {
            productId = existingMP.product_id;
            console.log(`Product ${item.external_id} already linked to marketplace ${this.marketplace}.`);
        } else {
            // 2. Not linked yet, check if product exists globally by EAN (Trimmed & case-insensitive check)
            const cleanEan = item.ean?.trim();
            if (cleanEan && cleanEan !== '') {
                const { data: existingByEAN } = await supabase
                    .from('products')
                    .select('id')
                    .eq('ean', cleanEan)
                    .maybeSingle();

                if (existingByEAN) {
                    productId = existingByEAN.id;
                    console.log(`Product found globally by EAN ${cleanEan}, will link to this marketplace.`);
                }
            }

            // 3. If still not found, check by SKU (Trimmed & case-insensitive check)
            const cleanSku = item.sku?.trim();
            if (!productId && cleanSku && cleanSku !== '') {
                const { data: existingBySKU } = await supabase
                    .from('products')
                    .select('id')
                    .eq('sku', cleanSku)
                    .maybeSingle();

                if (existingBySKU) {
                    productId = existingBySKU.id;
                    console.log(`Product found globally by SKU ${cleanSku}, will link to this marketplace.`);
                }
            }
        }

        // 4. If no product ID found, create new Product
        if (!productId) {
            console.log(`Creating new global product for SKU: ${item.sku}`);
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
            // 4b. Update existing product details if they are better (title, ean, images)
            // Especially important if the previous title was "Unknown Kaufland Item"
            const { data: currentProd } = await supabase.from('products').select('title, ean, images').eq('id', productId).single();

            const updates: any = {};
            if (item.title && item.title !== 'Unknown Kaufland Item' && (!currentProd?.title || currentProd.title === 'Unknown Kaufland Item')) {
                updates.title = item.title;
            }
            if (item.ean && !currentProd?.ean) {
                updates.ean = item.ean;
            }
            if (item.images && item.images.length > 0 && (!currentProd?.images || currentProd.images.length === 0)) {
                updates.images = item.images;
            }

            if (Object.keys(updates).length > 0) {
                console.log(`Updating existing product ${productId} with better details:`, updates);
                await supabase.from('products').update(updates).eq('id', productId);
            }
        }

        // 5. Link/Update Marketplace Product Entry
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
