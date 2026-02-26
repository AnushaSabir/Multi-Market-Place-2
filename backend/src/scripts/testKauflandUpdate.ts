
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testKauflandUpdate() {
    const accessToken = process.env.KAUFLAND_CLIENT_KEY;
    const secretKey = process.env.KAUFLAND_SECRET_KEY;
    const externalId = '389371064017'; // From previous turn debug output

    if (!accessToken || !secretKey) {
        console.error("Missing keys");
        return;
    }

    const updates = { price: 71.99 }; // Slight increase for test
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = `https://sellerapi.kaufland.com/v2/units/${externalId}?storefront=de`;
    const method = 'PATCH';
    const body = { listing_price: 1492 }; // New lower price for test
    const bodyStr = JSON.stringify(body);

    const stringToSign = `${method}\n${url}\n${bodyStr}\n${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

    console.log("Request URL:", url);
    console.log("Timestamp:", timestamp);
    console.log("Signature Base:", stringToSign.replace(/\n/g, '\\n'));
    console.log("Signature:", signature);

    try {
        const response = await axios.patch(url, bodyStr, {
            headers: {
                'Shop-Client-Key': accessToken,
                'Shop-Timestamp': timestamp,
                'Shop-Signature': signature,
                'User-Agent': 'EpicTec/1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log("Kaufland API Response Success (PATCH):");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error("Kaufland API Error (PATCH):");
        console.log(JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

testKauflandUpdate();
