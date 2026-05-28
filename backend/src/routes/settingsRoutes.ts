import express from 'express';
import { supabase } from '../database/supabaseClient';

const router = express.Router();

// GET /api/settings/pricing-rules
router.get('/pricing-rules', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('marketplace_settings')
            .select('*');

        if (error) {
            // Fail silently if table doesn't exist yet
            if (error.message.includes('relation "public.marketplace_settings" does not exist')) {
                return res.json({ data: [] });
            }
            throw error;
        }

        res.json({ data: data || [] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/pricing-rules
router.post('/pricing-rules', async (req, res) => {
    try {
        const { rules } = req.body;
        // rules: Array of { marketplace: string, operator: string, value: number }

        if (!Array.isArray(rules)) {
            return res.status(400).json({ error: 'rules must be an array' });
        }

        for (const rule of rules) {
            const ruleString = JSON.stringify({ operator: rule.operator, value: rule.value });
            await supabase
                .from('marketplace_settings')
                .upsert({ 
                    marketplace: rule.marketplace, 
                    auto_price_rule: ruleString 
                }, { onConflict: 'marketplace' });
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
