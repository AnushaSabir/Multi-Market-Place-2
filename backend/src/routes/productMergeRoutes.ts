import { Router } from 'express';
import { supabase } from '../database/supabaseClient';

const router = Router();

// POST /api/products/merge
// Merges multiple products into a master product
router.post('/merge', async (req, res) => {
    try {
        const { masterProductId, productIdsToMerge, newStock, mergeStrategy } = req.body;

        if (!masterProductId || !productIdsToMerge || !Array.isArray(productIdsToMerge) || productIdsToMerge.length === 0) {
            return res.status(400).json({ error: 'masterProductId and productIdsToMerge array are required' });
        }

        // 1. Fetch master product to ensure it exists
        const { data: masterProduct, error: masterError } = await supabase
            .from('products')
            .select('*')
            .eq('id', masterProductId)
            .single();

        if (masterError || !masterProduct) {
            return res.status(404).json({ error: 'Master product not found' });
        }

        // 2. Fetch all products to merge
        const { data: productsToMerge, error: fetchMergeError } = await supabase
            .from('products')
            .select('id, quantity, title, price')
            .in('id', productIdsToMerge);

        if (fetchMergeError) {
            return res.status(500).json({ error: 'Failed to fetch products to merge' });
        }

        // Compute Price Strategy
        let finalPrice = masterProduct.price || 0;
        const priceStrategyVal = req.body.priceStrategy || 'master';
        if (priceStrategyVal === 'highest') {
            const maxPrice = Math.max(finalPrice, ...(productsToMerge || []).map(p => p.price || 0));
            finalPrice = maxPrice;
        } else if (priceStrategyVal === 'average') {
            const allPrices = [finalPrice, ...(productsToMerge || []).map(p => p.price || 0)];
            const sum = allPrices.reduce((a, b) => a + b, 0);
            finalPrice = sum / allPrices.length;
        }

        // 3. Update master product stock if newStock is provided, and price if strategy used
        if (newStock !== undefined) {
            const stockChange = newStock - (masterProduct.quantity || 0);
            
            const updates: any = { quantity: newStock };
            if (priceStrategyVal !== 'master') {
                updates.price = finalPrice;
            }

            const { error: updateMasterError } = await supabase
                .from('products')
                .update(updates)
                .eq('id', masterProductId);

            if (updateMasterError) {
                return res.status(500).json({ error: 'Failed to update master product' });
            }

            // Log the merge stock movement
            await supabase
                .from('stock_movements')
                .insert({
                    product_id: masterProductId,
                    change: stockChange,
                    current_stock: newStock,
                    platform: 'System',
                    type: 'merge',
                    user_name: 'Admin'
                });
        }

        // 4. Reassign marketplace_products from merged products to master product
        // Note: In a real system, you might need to handle duplicate marketplaces. 
        // For now, we will simply try to update product_id, and ignore unique constraint errors.
        for (const pid of productIdsToMerge) {
            const { data: mpData } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('product_id', pid);

            if (mpData && mpData.length > 0) {
                for (const mp of mpData) {
                    // Try to reassign. If it fails (e.g. master already has this marketplace), we just delete the old one or ignore.
                    const { error: reassignError } = await supabase
                        .from('marketplace_products')
                        .update({ product_id: masterProductId })
                        .eq('id', mp.id);
                    
                    if (reassignError) {
                        // Probably a unique constraint violation (product_id, marketplace). We can safely ignore and let it delete on CASCADE.
                        console.log(`Could not reassign marketplace ${mp.marketplace} from ${pid} to master ${masterProductId}`);
                    }
                }
            }
        }

        // 5. Delete the merged products (this will CASCADE delete any remaining marketplace_products)
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .in('id', productIdsToMerge);

        if (deleteError) {
            return res.status(500).json({ error: 'Failed to delete merged products', details: deleteError.message });
        }

        res.json({ message: 'Products successfully merged', masterProductId, newStock });
    } catch (err: any) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

export default router;
