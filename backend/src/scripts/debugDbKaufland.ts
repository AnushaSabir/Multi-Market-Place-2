
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugKauflandData() {
    console.log("Fetching Kaufland products from marketplace_products and products tables...");

    const { data: mps, error: mpError } = await supabase
        .from('marketplace_products')
        .select(`
            marketplace,
            external_id,
            price,
            quantity,
            product_id,
            products (
                id,
                title,
                ean,
                sku,
                images
            )
        `)
        .eq('marketplace', 'kaufland')
        .limit(10);

    if (mpError) {
        console.error("Error fetching marketplace products:", mpError);
        return;
    }

    console.log("Sample Kaufland Data in DB:");
    console.log(JSON.stringify(mps, null, 2));
}

debugKauflandData();
