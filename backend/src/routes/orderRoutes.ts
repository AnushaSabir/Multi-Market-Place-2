import express from 'express';
import { supabase } from '../database/supabaseClient';
import { DhlService } from '../services/dhlService';
import { InvoiceService } from '../services/invoiceService';
import { CancellationService } from '../services/cancellationService';

const router = express.Router();

// Get all orders (with customer info)
router.get('/', async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(first_name, last_name, email),
                items:order_items(title, quantity, unit_price, sku, product:products(weight, dhl_versandart))
            `)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Process orders to calculate shipping_provider based on weight to mimic Billbee
        const processedOrders = orders.map(order => {
            let totalWeight = 0;
            let isKleinpaket = true; 
            
            if (order.items && order.items.length > 0) {
                for (const item of order.items) {
                    // Default to 0.5kg if weight is missing or 0 so it defaults to small package for single items, and normal DHL for multiple items
                    const weight = (item.product?.weight && item.product.weight > 0) ? item.product.weight : 0.5;
                    totalWeight += (weight * item.quantity);
                    
                    if (item.product?.dhl_versandart === 'Paket') {
                        isKleinpaket = false;
                    }
                }
            } else {
                isKleinpaket = false; // No items -> Safe fallback to DHL Paket
            }
            
            if (totalWeight > 1) {
                isKleinpaket = false;
            }

            // Billbee ID for DHL Kleinpaket is 300000000031621.
            // For normal DHL, we use a different ID (e.g. 300000000031622) so it falls into the "DHL" category in the app
            const calculatedProvider = isKleinpaket ? 300000000031621 : 300000000031622;

            const finalProvider = (!order.shipping_provider || String(order.shipping_provider).trim() === '') ? calculatedProvider : order.shipping_provider;

            return {
                ...order,
                shipping_provider: finalProvider,
                shipping_weight: totalWeight
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
