
import { SyncService } from '../services/syncService';
import { supabase } from '../database/supabaseClient';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testUpdate() {
    // 1. Find a product that is linked to Kaufland or eBay
    const { data: link, error } = await supabase
        .from('marketplace_products')
        .select('product_id, marketplace, external_id')
        .eq('marketplace', 'kaufland')
        .limit(1)
        .single();

    if (error || !link) {
        console.error("No product linked to Kaufland or eBay found in DB to test with.");
        return;
    }

    console.log(`Testing sync for Product ID: ${link.product_id} on Marketplace: ${link.marketplace}`);

    // 2. Trigger sync
    try {
        await SyncService.syncProductUpdateToAll(link.product_id, {
            price: 59.99,
            quantity: 10
        });
        console.log("Sync trigger finished. Check logs above.");
    } catch (err) {
        console.error("Sync trigger failed:", err);
    }
}

testUpdate();
