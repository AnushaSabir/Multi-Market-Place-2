import { config } from 'dotenv';
import path from 'path';

// Load .env from backend directory
config({ path: path.resolve(__dirname, '../../.env') });

import axios from 'axios';
import qs from 'qs';

async function testAuth(isSandbox: boolean) {
    const clientId = process.env.OTTO_CLIENT_ID;
    const clientSecret = process.env.OTTO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Missing credentials");
        return;
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = isSandbox 
        ? 'https://sandbox.api.otto.market/v1/token' 
        : 'https://api.otto.market/v1/token';

    console.log(`Testing Otto Auth on ${isSandbox ? 'Sandbox' : 'Live'}...`);
    try {
        const res = await axios.post(tokenUrl, qs.stringify({
            grant_type: 'client_credentials',
            scope: 'products availability'
        }), {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(`Success on ${isSandbox ? 'Sandbox' : 'Live'}! Token: ${res.data.access_token.substring(0, 15)}...`);
    } catch (error: any) {
        console.error(`Failed on ${isSandbox ? 'Sandbox' : 'Live'}:`, error.response?.data || error.message);
    }
}

async function run() {
    await testAuth(false); // Test Live
    await testAuth(true);  // Test Sandbox
}

run();
