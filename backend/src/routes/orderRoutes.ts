import express from 'express';
import { supabase } from '../database/supabaseClient';
import { DhlService } from '../services/dhlService';
import { InvoiceService } from '../services/invoiceService';
import { CancellationService } from '../services/cancellationService';
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

// Get all orders (with customer info)
router.get('/', async (req, res) => {
    try {
        const filterToday = req.query.today === 'true';
        const stateFilter = typeof req.query.state === 'string' ? req.query.state : undefined;
        const marketplaceFilter = typeof req.query.marketplace === 'string' ? req.query.marketplace : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
        const shippingBucketFilter = typeof req.query.shipping_bucket === 'string' ? req.query.shipping_bucket : undefined;
        const startOfDay = getStartOfTodayInTimeZone('Europe/Berlin');

        let query = supabase
            .from('orders')
            .select(`
                *,
                customer:customers(first_name, last_name, email),
                items:order_items(*, product:products(*))
            `)
            .gte('created_at', getPicklistCutoffDate().toISOString())
            .order('created_at', { ascending: false });

        if (stateFilter && stateFilter !== 'all') {
            if (stateFilter === 'active') {
                query = query.in('state', ['paid', 'ready_to_ship', 'ready_to_pick']);
            } else if (stateFilter === 'archived') {
                query = query.in('state', ['picked', 'shipped', 'cancelled', 'pending']);
            } else {
                query = query.eq('state', stateFilter);
            }
        }

        if (marketplaceFilter && marketplaceFilter !== 'all') {
            query = query.eq('marketplace', marketplaceFilter);
        }

        if (filterToday) {
            query = query.gte('created_at', startOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) throw new Error(error.message);

        // Process orders to calculate the same DHL vs Small Package split used by picklist.
        const processedOrders = orders.map(order => {
            const shipping = classifyOrderShipping(order.items || [], order.shipping_provider);

            const sanitizedItems = order.items ? order.items.map((item: any) => {
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
            }) : [];

            return {
                ...order,
                items: sanitizedItems,
                ...shipping
            };
        }).filter((order: any) => {
            if (stateFilter === 'active' || !stateFilter) {
                if (!isPicklistEligibleOrder(order)) return false;
            }

            if (shippingBucketFilter && shippingBucketFilter !== 'all' && order.shipping_bucket !== shippingBucketFilter) {
                return false;
            }

            if (!search) return true;

            const searchableText = [
                order.order_number,
                order.marketplace,
                order.state,
                order.customer?.first_name,
                order.customer?.last_name,
                order.customer?.email,
                ...(order.items || []).flatMap((item: any) => [
                    item.sku,
                    item.title,
                    item.display_name,
                    item.product?.sku,
                    item.product?.title
                ])
            ].filter(Boolean).join(' ').toLowerCase();

            return searchableText.includes(search);
        });

        res.json({
            success: true,
            test_version: '1.0.4',
            date_filter: filterToday ? startOfDay.toISOString() : getPicklistCutoffDate().toISOString(),
            filters: {
                state: stateFilter || 'active',
                marketplace: marketplaceFilter || 'all',
                shipping_bucket: shippingBucketFilter || 'all',
                search
            },
            data: processedOrders
        });
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

// Generate DHL Label
router.post('/:id/dhl-label', async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await DhlService.generateLabel(orderId);
        
        // Auto-generate invoice and send email when label is created (Shipment Confirmation)
        try {
            await InvoiceService.createAndSendInvoice(orderId);
            console.log(`[Order Route] Auto-generated and emailed invoice for order ${orderId}`);
        } catch (invErr) {
            console.error(`[Order Route] Failed to auto-generate invoice:`, invErr);
            // We don't fail the label generation if invoice fails, just log it
        }

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate Invoice Manually
router.post('/:id/invoice', async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await InvoiceService.createAndSendInvoice(orderId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel Order
router.post('/:id/cancel', async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await CancellationService.cancelOrder(orderId);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
