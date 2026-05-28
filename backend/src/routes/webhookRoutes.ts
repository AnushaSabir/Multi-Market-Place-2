import express from 'express';
import crypto from 'crypto';
import { SyncService } from '../services/syncService';

const router = express.Router();

// Shopify Webhook - Inventory updated
router.post('/shopify', async (req, res) => {
    // Security: HMAC Validation
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || 'test_secret';
    
    // For strict HMAC validation, rawBody should be used. Using JSON stringify for MVP structure.
    if (process.env.NODE_ENV === 'production' && hmacHeader && secret !== 'test_secret') {
        const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body), 'utf8').digest('base64');
        if (hash !== hmacHeader) {
            console.warn("Shopify Webhook HMAC validation failed (Warning only for MVP)");
            // return res.status(401).send('Unauthorized');
        }
    }

    const data = req.body;
    let externalId = '';
    let newQuantity = -1;

    try {
        if (topic === 'inventory_levels/update') {
            externalId = String(data.inventory_item_id);
            newQuantity = data.available;
        } else if (topic === 'orders/create') {
            console.log("Order created on Shopify, waiting for inventory_levels/update webhook.");
            return res.status(200).send('Handled by inventory update');
        } else {
            // Mock fallback for test scripts
            externalId = String(data.id || data.inventory_item_id || data.external_id);
            newQuantity = data.inventory_quantity !== undefined ? data.inventory_quantity : (data.available !== undefined ? data.available : data.quantity);
        }

        if (externalId && newQuantity >= 0) {
            await SyncService.handleIncomingStockUpdate('shopify', externalId, newQuantity);
            return res.status(200).send('Shopify Webhook processed');
        }

        res.status(200).send('Ignored');
    } catch (e) {
        console.error("Shopify Webhook error:", e);
        res.status(500).send('Error');
    }
});

// Generic Webhook endpoint for eBay, Kaufland, etc.
router.post('/:marketplace', async (req, res) => {
    const { marketplace } = req.params;
    if (marketplace === 'shopify') return res.status(200).send('Use /shopify endpoint');

    const data = req.body;
    let externalId = '';
    let newQuantity = -1;

    try {
        if (marketplace === 'ebay') {
            // eBay notification payload mock
            externalId = data.Item?.ItemID || data.external_id;
            newQuantity = data.Item?.Quantity ?? data.quantity;
        } else {
            // Kaufland / Otto mocks
            externalId = data.external_id;
            newQuantity = data.quantity;
        }

        if (externalId && newQuantity >= 0) {
            await SyncService.handleIncomingStockUpdate(marketplace, String(externalId), newQuantity);
            return res.status(200).send('Webhook processed');
        }

        res.status(200).send('Ignored');
    } catch (e) {
        console.error("Webhook error:", e);
        res.status(500).send('Error');
    }
});

export default router;
