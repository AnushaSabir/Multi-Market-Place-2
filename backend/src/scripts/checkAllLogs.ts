
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log("Fetching last 20 ANY logs...");
    const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.table(data.map(l => ({
        created_at: l.created_at,
        marketplace: l.marketplace,
        action: l.action,
        status: l.status,
        error: l.error_message?.substring(0, 100)
    })));
}

checkLogs();
