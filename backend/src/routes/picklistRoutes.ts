import express from 'express';
import { supabase } from '../database/supabaseClient';

const router = express.Router();

// GET /api/picklist
// Fetch orders ready for picking (state = 'paid')
router.get('/', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                invoice_address:addresses!invoice_address_id(*),
                delivery_address:addresses!delivery_address_id(*),
                items:order_items(*)
            `)
            .eq('state', 'paid')
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);

        // Enhance data for Picklist (calculate if multi-item 'double order' and add shipping provider)
        const enhancedOrders = orders.map((order: any) => {
            const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
            const isSingleItem = order.items.length === 1 && totalQuantity === 1;
            
            let totalWeight = 0;
            let isKleinpaket = true; 
            
            if (order.items && order.items.length > 0) {
                for (const item of order.items) {
                    const weight = (item.product?.weight && item.product.weight > 0) ? item.product.weight : 0.5;
                    totalWeight += (weight * item.quantity);
                    
                    if (item.product?.dhl_versandart === 'Paket') {
                        isKleinpaket = false;
                    }
                }
            } else {
                isKleinpaket = true;
            }
            
            if (totalWeight > 1) {
                isKleinpaket = false;
            }

            const calculatedProvider = isKleinpaket ? 300000000031622 : 300000000031621;
            const finalProvider = (!order.shipping_provider || String(order.shipping_provider).trim() === '') ? calculatedProvider : order.shipping_provider;
            
            return {
                ...order,
                is_single_item: isSingleItem,
                total_quantity: totalQuantity,
                customer_name: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Unknown',
                shipping_provider: finalProvider,
                shipping_weight: totalWeight
            };
        });

        res.json({ success: true, data: enhancedOrders });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/picklist/:id/pick
// Mark order as picked
router.post('/:id/pick', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { error } = await supabase
            .from('orders')
            .update({ state: 'picked' })
            .eq('id', orderId);

        if (error) throw new Error(error.message);

        res.json({ success: true, message: 'Order marked as picked' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
