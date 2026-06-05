import express from 'express';
import multer from 'multer';
import { FileImporter } from '../services/importers/fileImporter';
import { BaseImporter } from '../services/importers/baseImporter';
import fs from 'fs';

import os from 'os';
const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// POST /api/import/file
router.post('/file', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileType = req.file.originalname.endsWith('.csv') ? 'csv' : 'xlsx';

    try {
        const importer = new FileImporter(filePath, fileType);
        const result = await importer.runImport();

        // Cleanup
        fs.unlinkSync(filePath);

        if (result.success) {
            res.json({ message: 'File imported successfully', count: result.count });
        } else {
            res.status(500).json({ error: 'Import failed', details: result.error });
        }
    } catch (e: any) {
        console.error(e);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: e.message });
    }
});

// Import specific importers
import { OttoImporter } from '../services/importers/ottoImporter';
import { EbayImporter } from '../services/importers/ebayImporter';
import { KauflandImporter } from '../services/importers/kauflandImporter';

// POST /api/import/otto
router.post('/otto', async (req, res) => {
    try {
        const importer = new OttoImporter();
        const result = await importer.runImport();
        if (result.success) {
            res.json({ message: 'Otto import completed', count: result.count });
        } else {
            res.status(500).json({ error: 'Otto import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/otto/orders
router.post('/otto/orders', async (req, res) => {
    try {
        const importer = new OttoImporter();
        const result = await importer.importOrders();
        if (result.success) {
            res.json({ message: 'Otto orders imported', count: result.count });
        } else {
            res.status(500).json({ error: 'Otto orders import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/ebay
router.post('/ebay', async (req, res) => {
    try {
        const importer = new EbayImporter();
        const result = await importer.runImport();
        if (result.success) {
            res.json({ message: 'eBay import completed', count: result.count });
        } else {
            res.status(500).json({ error: 'eBay import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/ebay/orders
router.post('/ebay/orders', async (req, res) => {
    try {
        const importer = new EbayImporter();
        const result = await importer.importOrders();
        if (result.success) {
            res.json({ message: 'eBay orders imported', count: result.count });
        } else {
            res.status(500).json({ error: 'eBay orders import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/kaufland
router.post('/kaufland', async (req, res) => {
    try {
        const importer = new KauflandImporter();
        const result = await importer.runImport();
        if (result.success) {
            res.json({ message: 'Kaufland import completed', count: result.count });
        } else {
            res.status(500).json({ error: 'Kaufland import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/kaufland/orders
router.post('/kaufland/orders', async (req, res) => {
    try {
        const importer = new KauflandImporter();
        const result = await importer.importOrders();
        if (result.success) {
            res.json({ message: 'Kaufland orders imported', count: result.count });
        } else {
            res.status(500).json({ error: 'Kaufland orders import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

import { ShopifyImporter } from '../services/importers/shopifyImporter';

// POST /api/import/shopify
router.post('/shopify', async (req, res) => {
    try {
        const importer = new ShopifyImporter();
        const result = await importer.runImport();
        if (result.success) {
            res.json({ message: 'Shopify import completed', count: result.count });
        } else {
            res.status(500).json({ error: 'Shopify import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/shopify/orders
router.post('/shopify/orders', async (req, res) => {
    try {
        const importer = new ShopifyImporter();
        const result = await importer.importOrders();
        if (result.success) {
            res.json({ message: 'Shopify orders imported', count: result.count });
        } else {
            res.status(500).json({ error: 'Shopify orders import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import/stop
router.post('/stop', (req, res) => {
    BaseImporter.stopImport = true;
    res.json({ message: "Import stop signal sent." });
});

import { AmazonCrawler } from '../services/importers/amazonCrawler';

// POST /api/import/amazon
router.post('/amazon', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: "Please provide an array of URLs" });
        }
        
        const crawler = new AmazonCrawler();
        const result = await crawler.importUrls(urls);
        
        if (result.success) {
            res.json({ message: 'Amazon import completed. Products are in Draft status.', count: result.count });
        } else {
            res.status(500).json({ error: 'Amazon import failed', details: result.error });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/import/status
router.get('/status', (req, res) => {
    res.json({ isRunning: BaseImporter.isRunning });
});

export default router;
