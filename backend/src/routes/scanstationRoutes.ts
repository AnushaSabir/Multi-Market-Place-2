import express from 'express';
import { supabase } from '../database/supabaseClient';
import { DhlService } from '../services/dhlService';
import { InvoiceService } from '../services/invoiceService';

const router = express.Router();

// GET /api/scanstation/order/:orderNumber
// Fetch order details for scanning (must be in 'picked' state, or 'paid' if we want to allow skipping picklist)
router.get('/order/:orderNumber', async (req, res) => {
    try {
        const orderNumber = req.params.orderNumber;
        
        // Find order by order_number or id (barcode might be ID or OrderNumber)
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                items:order_items(*)
            `)
            .eq('order_number', orderNumber)
            .single();

        if (error || !order) {
            return res.status(404).json({ success: false, error: 'Order not found or invalid barcode' });
        }

        // Check state - should not be already shipped
        if (order.state === 'shipped') {
            return res.status(400).json({ success: false, error: 'Order is already shipped!' });
        }

        res.json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/scanstation/pack/:id
// Mark as packed, generate DHL label and Invoice
router.post('/pack/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Update state to packed (or shipped depending on flow, we'll use shipped to mark it complete)
        const { error: updateError } = await supabase
            .from('orders')
            .update({ state: 'shipped' })
            .eq('id', orderId);

        if (updateError) throw new Error(updateError.message);

        // Generate DHL Label
        const labelResult = await DhlService.generateLabel(orderId);

        // Auto-generate invoice and send email
        try {
            await InvoiceService.createAndSendInvoice(orderId);
            console.log(`[ScanStation] Auto-generated and emailed invoice for order ${orderId}`);
        } catch (invErr) {
            console.error(`[ScanStation] Failed to auto-generate invoice:`, invErr);
        }

        res.json({ success: true, label: labelResult });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
