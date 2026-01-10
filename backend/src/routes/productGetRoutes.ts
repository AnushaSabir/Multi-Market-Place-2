import express from 'express';
import { supabase } from '../database/supabaseClient';

const router = express.Router();

// GET /api/products
// Fetch all products with optional filters
router.get('/', async (req, res) => {
    // Default to a high limit to show "all" products as requested, unless specified
    const { page = 1, limit = 10000, status } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .range(from, to);

    if (status) {
        query = query.eq('status', status);
    }

    // Default sort by created_at desc if not specified, to show newest first
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, count, page: Number(page), limit: Number(limit) });
});

// GET /api/products/stats - Dashboard Statistics
router.get('/stats', async (req, res) => {
    try {
        // Total products
        const { count: totalCount, error: totalError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        // Marketplace counts using efficient count queries to avoid 1000 row limit
        const getMpCount = async (mp: string) => {
            const { count, error } = await supabase
                .from('marketplace_products')
                .select('*', { count: 'exact', head: true })
                .eq('marketplace', mp);
            if (error) throw error;
            return count || 0;
        };

        const [ottoCount, ebayCount, kauflandCount, shopifyCount] = await Promise.all([
            getMpCount('otto'),
            getMpCount('ebay'),
            getMpCount('kaufland'),
            getMpCount('shopify')
        ]);

        // Total synced is sum of all
        const totalSynced = ottoCount + ebayCount + kauflandCount + shopifyCount;

        // Real "AI Optimized" count
        const { count: optimizedCount, error: optError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'optimized');

        if (optError) throw optError;

        const stats = {
            total: totalCount || 0,
            aiOptimized: optimizedCount || 0,
            synced: totalSynced,
            marketplaces: {
                otto: ottoCount,
                ebay: ebayCount,
                kaufland: kauflandCount,
                shopify: shopifyCount
            }
        };

        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[GET] Fetching product with ID: ${id}`);
    const { data: userData, error } = await supabase
        .from('products')
        .select(`
            *,
            marketplace_products (
                marketplace,
                external_id,
                price,
                quantity,
                sync_status,
                last_synced_at
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error(`[GET] Product fetch error for ID ${id}:`, error.message);
        return res.status(404).json({ error: 'Product not found', details: error.message });
    }
    res.json({ data: userData }); // Wrap in { data: ... } to match frontend expectation
});

export default router;
