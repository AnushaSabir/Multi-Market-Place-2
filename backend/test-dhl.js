const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testDHL(isProd) {
    const creds = isProd ? {
        user: process.env.DHL_API_USER_PROD,
        pass: process.env.DHL_API_PASS_PROD,
        clientId: process.env.DHL_CLIENT_ID_PROD,
        baseUrl: 'https://api-eu.dhl.com/parcel/de/shipping/v2'
    } : {
        user: 'user-valid',
        pass: 'SandboxPasswort2023!',
        clientId: 'V1qSe5ra82UYjCeSU5TzcFc7E4cWa110',
        baseUrl: 'https://api-sandbox.dhl.com/parcel/de/shipping/v2'
    };

    const payload = {
        profile: "STANDARD_GRUPPENPROFIL",
        shipments: [
            {
                product: "V01PAK",
                billingNumber: isProd ? "33333333330101" : "22222222220101", // We don't have the real Prod EKP, maybe it will return 400 Bad Request
                refNo: "DEMO-1001",
                shipper: {
                    name1: "EpicTec Store",
                    addressStreet: "Musterstr.",
                    addressHouse: "1",
                    postalCode: "12345",
                    city: "Berlin",
                    country: "DEU"
                },
                receiver: {
                    name1: "Max Mustermann",
                    addressStreet: "Musterstraße",
                    addressHouse: "12",
                    postalCode: "10115",
                    city: "Berlin",
                    country: "DEU"
                },
                details: {
                    dim: { uom: "mm", length: 300, width: 200, height: 150 },
                    weight: { uom: "kg", value: 1.0 }
                }
            }
        ]
    };

    try {
        const auth = Buffer.from(`${creds.user}:${creds.pass}`).toString('base64');
        const response = await axios.post(`${creds.baseUrl}/orders?validate=true`, payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'dhl-api-key': creds.clientId,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            validateStatus: () => true
        });

        console.log(`[${isProd ? 'PROD' : 'SANDBOX'}] Status:`, response.status);
        console.log(`[${isProd ? 'PROD' : 'SANDBOX'}] Data:`, JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error(`[${isProd ? 'PROD' : 'SANDBOX'}] Error:`, e.message);
    }
}

testDHL(false).then(() => testDHL(true));
