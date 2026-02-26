
import crypto from 'crypto';

const clientKey = '20689f89b8976c59cc753634e21e2802';
const secretKey = 'a2a448bf65e9c8047ce74c8db71b856152c5caca1dd8983884615522a46d53ff';
const externalId = '389371064017';
const timestamp = Math.floor(Date.now() / 1000).toString();
const url = `https://sellerapi.kaufland.com/v2/units/${externalId}?storefront=de`;
const method = 'PATCH';
const body = { listing_price: 1495 };
const bodyStr = JSON.stringify(body);

const stringToSign = `${method}\n${url}\n${bodyStr}\n${timestamp}`;
const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

console.log(`curl.exe -X PATCH -H "Content-Type: application/json" -H "Shop-Client-Key: ${clientKey}" -H "Shop-Timestamp: ${timestamp}" -H "Shop-Signature: ${signature}" -d "${bodyStr.replace(/"/g, '\\"')}" "${url}"`);
