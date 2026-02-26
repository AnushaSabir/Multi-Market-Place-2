
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend folder
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("Supabase URL in Script:", supabaseUrl);
console.log("Supabase Key Present:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStats() {
    console.log("Checking Database Stats...");

    // 1. Products Count
    const { count: productCount, error: pErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
    if (pErr) console.error("Product Error:", pErr);
    console.log(`Total Products in 'products' table: ${productCount}`);

    // 2. Marketplace Products Count
    const { count: mpCount, error: mpErr } = await supabase.from('marketplace_products').select('*', { count: 'exact', head: true });
    if (mpErr) console.error("MP Error:", mpErr);
    console.log(`Total Links in 'marketplace_products' table: ${mpCount}`);

    // 3. Verify Breakdown
    const { data: breakdown, error: bErr } = await supabase.from('marketplace_products').select('marketplace');
    if (bErr) console.error("Breakdown Error:", bErr);

    const counts: Record<string, number> = {};
    breakdown?.forEach((b: any) => {
        counts[b.marketplace] = (counts[b.marketplace] || 0) + 1;
    });

    console.log("Marketplace Breakdown:", counts);

    // 4. Check first 5 products to see if they have valid IDs
    const { data: products } = await supabase.from('products').select('id, title, status').limit(5);
    console.log("Sample Products:", products);
}

checkStats();
