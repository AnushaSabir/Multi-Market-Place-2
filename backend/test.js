require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('products')
        .select('*, marketplace_products(marketplace, external_id, sync_status)')
        .limit(2);
    
    if (error) {
        console.error("SUPABASE ERROR:", error);
    } else {
        console.log("SUCCESS. Data length:", data.length);
        if (data.length > 0) {
            console.log("Sample:", JSON.stringify(data[0].marketplace_products, null, 2));
        }
    }
}

test();
