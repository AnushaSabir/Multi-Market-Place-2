import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// These should be in .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_SUPABASE_URL')) {
    // console.error('\n\x1b[31m%s\x1b[0m', '************************************************************');
    // console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL ERROR: Missing Supabase Credentials');
    // console.error('\x1b[31m%s\x1b[0m', '************************************************************');
    // console.error('You need to configure your environment variables.');
    // process.exit(1);
    throw new Error('Missing Supabase Credentials: SUPABASE_URL or SUPABASE_KEY is not defined in environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
