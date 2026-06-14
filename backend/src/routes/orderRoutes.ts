import express from 'express';
import { supabase } from '../database/supabaseClient';
import { DhlService } from '../services/dhlService';
import { InvoiceService } from '../services/invoiceService';
import { CancellationService } from '../services/cancellationService';
import { classifyOrderShipping } from '../services/shippingClassifier';

const router = express.Router();

// Get all orders (with customer info)
router.get('/', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(first_name, last_name, email),
                items:order_items(*, product:products(*))
            `)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Process orders to calculate the same DHL vs Small Package split used by picklist.
        const processedOrders = orders.map(order => {
            const shipping = classifyOrderShipping(order.items || [], order.shipping_provider);

            const sanitizedItems = order.items ? order.items.map((item: any) => {
                let sku = item.sku;
                if (sku && /^\d+$/.test(sku)) {
                    sku = ''; // hide purely numeric SKUs
                }
                return { ...item, sku };
            }) : [];

            return {
                ...order,
                items: sanitizedItems,
                ...shipping
            };
        });

        res.json({ success: true, test_version: '1.0.3', data: processedOrders });
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
