
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkAllLogs() {
    console.log("Fetching latest 50 sync logs...");

    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log("Recent Sync Logs (all marketplaces):");
    logs?.forEach(l => {
        console.log(`[${l.created_at}] ${l.marketplace} ${l.action} ${l.status} ${l.error_message || ''}`);
    });
}

checkAllLogs();
