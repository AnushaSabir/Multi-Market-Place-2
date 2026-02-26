
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log("Fetching last 100 sync logs...");
    const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    const filtered = data.filter(l => l.marketplace === 'kaufland' || l.marketplace === 'ebay');
    console.log(`Found ${filtered.length} logs for Kaufland/eBay in last 100 logs`);

    console.table(filtered.slice(0, 20).map(l => ({
        created_at: l.created_at,
        marketplace: l.marketplace,
        action: l.action,
        status: l.status,
        error: l.error_message?.substring(0, 100)
    })));

    const latestFailures = filtered.filter(l => l.status === 'failed').slice(0, 5);
    if (latestFailures.length > 0) {
        console.log("\nRecent Failures:");
        latestFailures.forEach(f => {
            console.log(`--- ${f.marketplace} (${f.created_at}) ---`);
            console.log(f.error_message);
        });
    }
}

checkLogs();
