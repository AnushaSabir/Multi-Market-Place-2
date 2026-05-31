import express from 'express';
import { supabase } from '../database/supabaseClient';

const router = express.Router();

// Get all orders (with customer info)
router.get('/', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(first_name, last_name, email),
                items:order_items(title, quantity, unit_price, sku)
            `)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        res.json({ success: true, data: orders });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get single order details (including addresses)
router.get('/:id', async (req, res) => {
    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                invoice_address:addresses!invoice_address_id(*),
                delivery_address:addresses!delivery_address_id(*),
                items:order_items(*)
            `)
            .eq('id', req.params.id)
            .single();

        if (error) throw new Error(error.message);
        res.json({ success: true, data: order });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
