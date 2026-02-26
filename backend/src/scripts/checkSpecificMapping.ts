
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkMapping() {
    const externalId = '389371064017';
    console.log(`Checking link for Kaufland External ID: ${externalId}`);

    const { data: mp, error } = await supabase
        .from('marketplace_products')
        .select(`
            *,
            products ( * )
        `)
        .eq('external_id', externalId)
        .eq('marketplace', 'kaufland')
        .single();

    if (error) {
        console.error("Error fetching link:", error);
        return;
    }

    console.log("Marketplace Product Link:");
    console.log(JSON.stringify(mp, null, 2));
}

checkMapping();
