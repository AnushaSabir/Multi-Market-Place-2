
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testKauflandApi() {
    const accessToken = process.env.KAUFLAND_CLIENT_KEY;
    const secretKey = process.env.KAUFLAND_SECRET_KEY;

    if (!accessToken || !secretKey) {
        console.error("Missing keys");
        return;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const listUrl = `https://sellerapi.kaufland.com/v2/units/389371064017?storefront=de&embedded=products`;
    const body = '';

    const stringToSign = `${method}\n${listUrl}\n${body}\n${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

    try {
        const response = await axios.get(listUrl, {
            headers: {
                'Shop-Client-Key': accessToken,
                'Shop-Timestamp': timestamp,
                'Shop-Signature': signature,
                'User-Agent': 'MultiMarketplaceApp/1.0',
                'Accept': 'application/json'
            }
        });

        console.log("Kaufland API Response:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error("Kaufland API Error:", error.response?.data || error.message);
    }
}

testKauflandApi();
