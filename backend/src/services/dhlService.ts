import axios from 'axios';
import { supabase } from '../database/supabaseClient';

export class DhlService {
    private static getCredentials() {
        const useSandbox = process.env.DHL_USE_SANDBOX === 'true';
        return {
            user: useSandbox ? process.env.DHL_API_USER_SANDBOX : process.env.DHL_API_USER_PROD,
            pass: useSandbox ? process.env.DHL_API_PASS_SANDBOX : process.env.DHL_API_PASS_PROD,
            clientId: useSandbox ? process.env.DHL_CLIENT_ID_SANDBOX : process.env.DHL_CLIENT_ID_PROD,
            baseUrl: useSandbox ? 'https://api-sandbox.dhl.com/parcel/de/shipping/v2' : 'https://api-eu.dhl.com/parcel/de/shipping/v2'
        };
    }

    static async generateLabel(orderId: string) {
        console.log(`[DHL Service] Generating label for Order ID: ${orderId}`);
        const creds = this.getCredentials();

        if (!creds.user || !creds.clientId) {
            throw new Error("DHL Credentials not fully configured");
        }

        // 1. Fetch Order Details
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(*),
                delivery_address:addresses!delivery_address_id(*),
                items:order_items(quantity, unit_price, product:products(weight, dhl_versandart))
            `)
            .eq('id', orderId)
            .single();

        if (error || !order) throw new Error("Order not found or database error");
        if (!order.delivery_address) throw new Error("Delivery address is missing for this order");

        // 2. Calculate Total Weight and Determine Service
        let totalWeight = 0;
        let versandart = 'V01PAK'; // Default DHL Paket (V01PAK for Germany)

        for (const item of order.items) {
            const weight = (item.product?.weight && item.product.weight > 0) ? item.product.weight : 0.5;
            totalWeight += (weight * item.quantity);
        }
        if (totalWeight === 0) totalWeight = 1.0; // Minimum 1kg fallback

        // Note: For international shipping, different service codes are needed. We assume DE for MVP.
        const addr = order.delivery_address;
        
        // 3. Prepare DHL API Payload
        const payload = {
            profile: "STANDARD_GRUPPENPROFIL",
            shipments: [
                {
                    product: versandart,
                    billingNumber: "33333333330101", // Default Sandbox EKP
                    refNo: order.order_number,
                    shipper: {
                        name1: "EpicTec Store",
                        addressStreet: "Musterstr.",
                        addressHouse: "1",
                        postalCode: "12345",
                        city: "Berlin",
                        country: "DEU"
                    },
                    receiver: {
                        name1: `${addr.first_name} ${addr.last_name}`,
                        addressStreet: addr.street,
                        addressHouse: addr.house_number || "1",
                        postalCode: addr.zip,
                        city: addr.city,
                        country: addr.country_code === 'DE' ? 'DEU' : 'DEU' // Mapping required for countries
                    },
                    details: {
                        dim: { uom: "mm", length: 300, width: 200, height: 150 }, // Default dimensions
                        weight: { uom: "kg", value: totalWeight }
                    }
                }
            ]
        };

        try {
            // DHL Auth Header: Basic auth for User/Pass, Client-Id in headers
            const auth = Buffer.from(`${creds.user}:${creds.pass}`).toString('base64');
            
            const response = await axios.post(`${creds.baseUrl}/orders`, payload, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'dhl-api-key': creds.clientId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            // 4. Extract Tracking Number and PDF Label
            const result = response.data.items?.[0];
            if (!result || result.sstatus?.title === "Error") {
                const errMsg = result?.validationMessages?.[0]?.validationMessage || "Unknown DHL Error";
                throw new Error(`DHL API Error: ${errMsg}`);
            }

            const trackingNumber = result.shipmentNo;
            const base64Label = result.label?.b64;

            // 5. Save to Database
            await supabase
                .from('orders')
                .update({ 
                    dhl_tracking_number: trackingNumber,
                    dhl_label_url: `data:application/pdf;base64,${base64Label}`, // Store directly for MVP
                    state: 'shipped' // Automatically mark as shipped
                })
                .eq('id', orderId);

            return {
                success: true,
                trackingNumber,
                labelDataPdf: base64Label,
                labelUrl: base64Label ? `data:application/pdf;base64,${base64Label}` : null
            };
            
        } catch (error: any) {
            console.error("[DHL Error]", error.response?.data || error.message);
            throw new Error(error.response?.data?.detail || error.message || "Failed to generate label");
        }
    }
}
