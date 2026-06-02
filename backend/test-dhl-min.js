const axios = require('axios');

async function testDHL() {
    const creds = {
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
                billingNumber: "22222222220101",
                refNo: "Order123",
                shipper: {
                    name1: "My Company",
                    addressStreet: "Str",
                    addressHouse: "1",
                    postalCode: "53113",
                    city: "Bonn",
                    country: "DEU"
                },
                receiver: {
                    name1: "Jane Doe",
                    postalCode: "53113",
                    city: "Bonn",
                    country: "DEU",
                    addressStreet: "Str",
                    addressHouse: "1"
                },
                details: {
                    weight: {
                        uom: "kg",
                        value: 1
                    }
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

        console.log(`[SANDBOX] Status:`, response.status);
        console.log(`[SANDBOX] Data:`, JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error(`[SANDBOX] Error:`, e.message);
    }
}

testDHL();
