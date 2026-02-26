
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkCreds() {
    console.log("Checking credentials for Kaufland in marketplace_credentials table...");

    const { data: creds, error } = await supabase
        .from('marketplace_credentials')
        .select('*')
        .eq('marketplace', 'kaufland')
        .single();

    if (error) {
        console.error("Error fetching credentials:", error);
        return;
    }

    console.log("Kaufland Credentials in DB:");
    console.log(`ID: ${creds.id}`);
    console.log(`Client Key: ${creds.client_id || creds.client_key || 'missing'}`);
    console.log(`Secret Key found: ${!!(creds.client_secret || creds.secret_key)}`);
    console.log("Full Record Keys:", Object.keys(creds));
}

checkCreds();
