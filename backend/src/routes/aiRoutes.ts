import express from 'express';
import { supabase } from '../database/supabaseClient';
import { AIService } from '../services/aiService';

const router = express.Router();

// POST /api/ai/optimize/:id
// Optimizes a single product by ID
router.post('/optimize/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Fetch Product
        const { data: product, error } = await supabase
            .from('products')
            .select('title, description')
            .eq('id', id)
            .single();

        if (error || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        let optimized: { title: string; description: string; otto_attributes?: { weight?: string; capacity?: string } };
        
        if (!process.env.OPENAI_API_KEY) {
            console.error("OPENAI_API_KEY missing");
            return res.status(500).json({ error: "OpenAI API Key is missing. Please configure it in your Vercel Environment Variables." });
        }
        
        console.log("Calling OpenAI Service...");
        optimized = await AIService.optimizeProductListing(product.title, product.description);

        // 3. Update Product
        const { error: updateError } = await supabase
            .from('products')
            .update({
                title: optimized.title,
                description: optimized.description,
                weight: parseFloat(optimized.otto_attributes?.weight || '0') || undefined,
                status: 'optimized' // Mark as ready
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // 4. Trigger Sync to Marketplaces
        // This answers the user's question: "How to push back?" -> It happens automatically now!
        const { SyncService } = await import('../services/syncService');
        await SyncService.syncProductUpdateToAll(id, {
            title: optimized.title,
            description: optimized.description
        });

        res.json({
            success: true,
            original: { title: product.title },
            optimized: optimized,
            message: "Optimized and synced to connected marketplaces."
        });

    } catch (err: any) {
        console.error("Optimization Routes Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
