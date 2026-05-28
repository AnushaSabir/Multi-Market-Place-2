import { Router } from 'express';
import { supabase } from '../database/supabaseClient';

const router = Router();

// GET /api/products/:id/stock-movements
router.get('/:id/stock-movements', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stock movements:', error.message);
            // Don't crash if table doesn't exist yet
            if (error.message.includes('relation "public.stock_movements" does not exist')) {
                return res.json({ data: [] });
            }
            return res.status(500).json({ error: error.message });
        }

        res.json({ data: data || [] });
    } catch (err: any) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// POST /api/products/:id/stock
// Updates global stock and logs a movement
router.post('/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        const { change, current_stock, platform, order_id, type, user_name } = req.body;

        if (change === undefined || current_stock === undefined) {
            return res.status(400).json({ error: 'change and current_stock are required' });
        }

        // 1. Update product quantity
        const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: current_stock })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update stock', details: updateError.message });
        }

        // 2. Log movement (fail silently if table doesn't exist yet, to not break existing app flow)
        const { error: insertError } = await supabase
            .from('stock_movements')
            .insert({
                product_id: id,
                change,
                current_stock,
                order_id: order_id || null,
                platform: platform || 'System',
                type: type || 'manual',
                user_name: user_name || 'Admin'
            });

        if (insertError) {
            console.error('Failed to log stock movement:', insertError.message);
        }

        res.json({ message: 'Stock updated and logged', current_stock });
    } catch (err: any) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

export default router;
