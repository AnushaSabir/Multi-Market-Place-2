import express from 'express';
import { supabase } from '../database/supabaseClient';
import { classifyOrderShipping } from '../services/shippingClassifier';
import { getPicklistCutoffDate, isPicklistEligibleOrder } from '../services/picklistEligibility';

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
        const filterToday = req.query.today === 'true';
        const startOfDay = getStartOfTodayInTimeZone('Europe/Berlin');

        let query = supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                invoice_address:addresses!invoice_address_id(*),
                delivery_address:addresses!delivery_address_id(*),
                items:order_items(*, product:products(*))
            `).in('state', ['paid', 'ready_to_ship', 'ready_to_pick'])
            .gte('created_at', getPicklistCutoffDate().toISOString())
            .order('created_at', { ascending: false });

        if (filterToday) {
            query = query.gte('created_at', startOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) throw new Error(error.message);

        // Enhance data for Picklist. Incomplete orders without line items are not pickable.
        const enhancedOrders = orders.filter((order: any) => isPicklistEligibleOrder(order)).map((order: any) => {
            const shipping = classifyOrderShipping(order.items, order.shipping_provider);
            const totalQuantity = shipping.total_quantity;
            const isSingleItem = order.items.length === 1 && totalQuantity === 1;

            const sanitizedItems = order.items.map((item: any) => {
                let sku = item.sku;
                if (sku && /^\d+$/.test(sku)) {
                    sku = item.title || item.product?.title || sku;
                }
                const meaningfulSku = sku && sku !== 'UNKNOWN' ? sku : '';
                return {
                    ...item,
                    sku,
                    display_name: meaningfulSku || item.title || item.product?.title || 'Unknown Item'
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
            date_filter: filterToday ? startOfDay.toISOString() : getPicklistCutoffDate().toISOString(),
            data: enhancedOrders
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/picklist/summary
// Lightweight diagnostics to verify which backend/data the app is reading.
router.get('/summary', async (req, res) => {
    try {
        const filterToday = req.query.today === 'true';
        const startOfDay = getStartOfTodayInTimeZone('Europe/Berlin');

        let query = supabase
            .from('orders')
            .select(`
                id,
                order_number,
                marketplace,
                state,
                shipping_provider,
                created_at,
                updated_at,
                items:order_items(*, product:products(*))
            `).in('state', ['paid', 'ready_to_ship', 'ready_to_pick'])
            .gte('created_at', getPicklistCutoffDate().toISOString())
            .order('created_at', { ascending: false });

        if (filterToday) {
            query = query.gte('created_at', startOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) throw new Error(error.message);

        const eligibleOrders = (orders || []).filter((order: any) => isPicklistEligibleOrder(order));
        const summary = eligibleOrders.reduce((acc: any, order: any) => {
            const shipping = classifyOrderShipping(order.items || [], order.shipping_provider);
            const bucket = shipping.shipping_bucket || 'unknown';
            const marketplace = order.marketplace || 'unknown';

            acc.buckets[bucket] = (acc.buckets[bucket] || 0) + 1;
            acc.quantities[bucket] = (acc.quantities[bucket] || 0) + shipping.total_quantity;
            acc.marketplaces[marketplace] = (acc.marketplaces[marketplace] || 0) + 1;
            return acc;
        }, {
            buckets: {},
            quantities: {},
            marketplaces: {}
        });

        res.json({
            success: true,
            commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
            generated_at: new Date().toISOString(),
            cutoff: filterToday ? startOfDay.toISOString() : getPicklistCutoffDate().toISOString(),
            total_orders: eligibleOrders.length,
            dhl_orders: summary.buckets.dhl || 0,
            small_package_orders: summary.buckets.small_package || 0,
            unknown_orders: summary.buckets.unknown || 0,
            quantities: summary.quantities,
            marketplaces: summary.marketplaces,
            latest_orders: eligibleOrders.slice(0, 10).map((order: any) => ({
                order_number: order.order_number,
                marketplace: order.marketplace,
                state: order.state,
                created_at: order.created_at,
                item_count: order.items?.length || 0
            }))
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
