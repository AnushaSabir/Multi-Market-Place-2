
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkKauflandLogs() {
    console.log("Fetching latest sync logs for Kaufland...");

    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('marketplace', 'kaufland')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log("Recent Kaufland Sync Logs:");
    console.log(JSON.stringify(logs, null, 2));

    // Also check marketplace_products state
    const { data: mps } = await supabase
        .from('marketplace_products')
        .select(`
            marketplace,
            external_id,
            price,
            quantity,
            sync_status,
            last_synced_at,
            products ( title )
        `)
        .eq('marketplace', 'kaufland')
        .limit(5);

    console.log("\nSample Kaufland Sync Status in DB:");
    console.log(JSON.stringify(mps, null, 2));
}

checkKauflandLogs();
