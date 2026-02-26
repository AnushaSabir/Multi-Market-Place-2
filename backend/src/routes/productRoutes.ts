import express from 'express';
import { OttoImporter } from '../services/importers/ottoImporter';
import { EbayImporter } from '../services/importers/ebayImporter';
import { KauflandImporter } from '../services/importers/kauflandImporter';
import { ShopifyImporter } from '../services/importers/shopifyImporter';
import { optimizeProduct } from '../services/ai/openaiService';
import { SyncService } from '../services/syncService';
import { supabase } from '../database/supabaseClient';

const router = express.Router();

// POST /api/products/import
router.post('/import', async (req, res) => {
    const { marketplace } = req.body;

    let importer;
    switch (marketplace) {
        case 'otto': importer = new OttoImporter(); break;
        case 'ebay': importer = new EbayImporter(); break;
        case 'kaufland': importer = new KauflandImporter(); break;
        case 'shopify': importer = new ShopifyImporter(); break;
        default:
            return res.status(400).json({ error: 'Invalid or missing marketplace' });
    }

    const result = await importer.runImport();
    if (result.success) {
        res.json({ message: `Import successful from ${marketplace}`, count: result.count });
    } else {
        res.status(500).json({ error: 'Import failed', details: result.error });
    }
});

// POST /api/products/:id/optimize
router.post('/:id/optimize', async (req, res) => {
    const { id } = req.params;
    const result = await optimizeProduct(id);
    if (result.success) {
        res.json({ message: 'Optimization successful', data: result.data });
    } else {
        res.status(500).json({ error: 'Optimization failed', details: result.error });
    }
});

// POST /api/products/:id/publish
router.post('/:id/publish', async (req, res) => {
    const { id } = req.params;
    const { marketplace } = req.body;

    let exporter;
    // Dynamic import to avoid circular dependency issues if any
    const { ShopifyExporter } = await import('../services/exporters/shopifyExporter');
    const { EbayExporter } = await import('../services/exporters/ebayExporter');
    const { OttoExporter } = await import('../services/exporters/ottoExporter');
    const { KauflandExporter } = await import('../services/exporters/kauflandExporter');

    switch (marketplace) {
        case 'shopify': exporter = new ShopifyExporter(); break;
        case 'ebay': exporter = new EbayExporter(); break;
        case 'otto': exporter = new OttoExporter(); break;
        case 'kaufland': exporter = new KauflandExporter(); break;
        default: return res.status(400).json({ error: 'Invalid marketplace' });
    }

    const start = await exporter.publishProduct(id);
    if (start.success) {
        res.json({ message: `Published to ${marketplace}`, external_id: start.external_id });
    } else {
        res.status(500).json({ error: 'Publish failed', details: start.error });
    }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { marketplace_products, ...updates } = req.body; // Remove relational data that isn't a column

    const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    if (updates.price !== undefined || updates.quantity !== undefined || updates.title || updates.description) {
        await SyncService.syncProductUpdateToAll(id, updates);
    }

    res.json({ message: 'Product updated and sync triggered' });
});

// DELETE /api/products/cleanup?marketplace=ebay
router.delete('/cleanup', async (req, res) => {
    const { marketplace } = req.query;
    if (!marketplace) return res.status(400).json({ error: "Marketplace required (e.g. ?marketplace=ebay or ?marketplace=all)" });

    try {
        if (marketplace === 'all') {
            // Use product_id check to avoid UUID vs Integer type error on 'id' column if it exists/is uuid
            const { error: mpError } = await supabase.from('marketplace_products').delete().neq('product_id', '00000000-0000-0000-0000-000000000000');
            if (mpError) throw mpError;
            const { error: pError } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (pError) throw pError;
            return res.json({ message: "All products and links deleted." });
        }

        const { error } = await supabase.from('marketplace_products').delete().eq('marketplace', marketplace);
        if (error) throw error;

        res.json({ message: `Cleared products for ${marketplace}` });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/batch
router.delete('/batch', async (req, res) => {
    const { ids } = req.body;

    console.log("Batch delete requested for IDs:", ids);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No IDs provided" });
    }

    // Validate if all are valid UUIDs to prevent PG error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter(id => !uuidRegex.test(id));

    if (invalidIds.length > 0) {
        console.error("Invalid UUIDs detected:", invalidIds);
        return res.status(400).json({ error: `Invalid UUID format found: ${invalidIds.join(', ')}` });
    }

    try {
        // Delete dependencies first
        await supabase.from('marketplace_products').delete().in('product_id', ids);

        const { error } = await supabase.from('products').delete().in('id', ids);
        if (error) throw error;

        res.json({ message: `Successfully deleted ${ids.length} products.` });
    } catch (err: any) {
        console.error("Batch delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Cascade delete should handle marketplace_products if configured, 
        // otherwise we delete Manually for safety.
        await supabase.from('marketplace_products').delete().eq('product_id', id);

        const { error } = await supabase.from('products').delete().eq('id', id);

        if (error) throw error;

        res.json({ message: 'Product deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
