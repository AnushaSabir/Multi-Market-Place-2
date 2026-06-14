import express from 'express';
import { supabase } from '../database/supabaseClient';
import { classifyOrderShipping } from '../services/shippingClassifier';

const router = express.Router();

function getStartOfTodayInTimeZone(timeZone: string) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);

    const year = Number(parts.find(part => part.type === 'year')?.value);
    const month = Number(parts.find(part => part.type === 'month')?.value);
    const day = Number(parts.find(part => part.type === 'day')?.value);
    const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const zonedParts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(utcGuess);

    const zonedAsUtc = Date.UTC(
        Number(zonedParts.find(part => part.type === 'year')?.value),
        Number(zonedParts.find(part => part.type === 'month')?.value) - 1,
        Number(zonedParts.find(part => part.type === 'day')?.value),
        Number(zonedParts.find(part => part.type === 'hour')?.value),
        Number(zonedParts.find(part => part.type === 'minute')?.value),
        Number(zonedParts.find(part => part.type === 'second')?.value)
    );

    return new Date(utcGuess.getTime() - (zonedAsUtc - utcGuess.getTime()));
}

// GET /api/picklist
// Fetch today's orders ready for picking (state = 'paid')
router.get('/', async (req, res) => {
    try {
        const showAll = req.query.all === 'true';
        const startOfDay = getStartOfTodayInTimeZone('Europe/Berlin');

        let query = supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                invoice_address:addresses!invoice_address_id(*),
                delivery_address:addresses!delivery_address_id(*),
                items:order_items(*, product:products(*))
            `).eq('state', 'paid')
            .order('created_at', { ascending: false });

        if (!showAll) {
            query = query.gte('created_at', startOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) throw new Error(error.message);

        // Enhance data for Picklist. Incomplete orders without line items are not pickable.
        const enhancedOrders = orders.filter((order: any) => order.items && order.items.length > 0).map((order: any) => {
            const shipping = classifyOrderShipping(order.items, order.shipping_provider);
            const totalQuantity = shipping.total_quantity;
            const isSingleItem = order.items.length === 1 && totalQuantity === 1;

            const sanitizedItems = order.items.map((item: any) => {
                let sku = item.sku;
                if (sku && /^\d+$/.test(sku)) {
                    sku = item.title || item.product?.title || sku;
                }
                return {
                    ...item,
                    sku,
                    display_name: item.title || sku || item.product?.title || 'Unknown Item'
                };
            });

            return {
                ...order,
                items: sanitizedItems,
                is_single_item: isSingleItem,
                customer_name: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Unknown',
                ...shipping
            };
        });

        res.json({
            success: true,
            date_filter: showAll ? 'all' : startOfDay.toISOString(),
            data: enhancedOrders
        });
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
