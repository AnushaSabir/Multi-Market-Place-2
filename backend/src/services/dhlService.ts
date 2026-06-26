import axios from 'axios';
import { supabase } from '../database/supabaseClient';

export class DhlService {
    private static getCredentials() {
        const useSandbox = process.env.DHL_USE_SANDBOX === 'true';
        const billingNumber = process.env.DHL_BILLING_NUMBER
            || process.env.DHL_BILLING_NUMBER_PROD
            || (process.env.DHL_EKP ? `${process.env.DHL_EKP}0102` : undefined)
            || (useSandbox ? '33333333330101' : undefined);

        return {
            user: useSandbox ? process.env.DHL_API_USER_SANDBOX : process.env.DHL_API_USER_PROD,
            pass: useSandbox ? process.env.DHL_API_PASS_SANDBOX : process.env.DHL_API_PASS_PROD,
            clientId: useSandbox ? process.env.DHL_CLIENT_ID_SANDBOX : process.env.DHL_CLIENT_ID_PROD,
            billingNumber,
            baseUrl: useSandbox ? 'https://api-sandbox.dhl.com/parcel/de/shipping/v2' : 'https://api-eu.dhl.com/parcel/de/shipping/v2'
        };
    }

    private static splitStreetAndHouse(street?: string | null, houseNumber?: string | null) {
        const cleanStreet = (street || '').trim();
        const cleanHouse = (houseNumber || '').trim();

        if (cleanHouse || !cleanStreet) {
            return { street: cleanStreet, house: cleanHouse };
        }

        const match = cleanStreet.match(/^(.+?)\s+(\d+\s*[a-zA-Z]?(?:[-/]\d+\s*[a-zA-Z]?)?)$/);
        if (!match) {
            return { street: cleanStreet, house: '' };
        }

        return { street: match[1].trim(), house: match[2].replace(/\s+/g, '') };
    }

    private static requiredAddressValue(value: unknown, label: string) {
        const text = typeof value === 'string' ? value.trim() : '';
        if (!text) {
            throw new Error(`Delivery address is missing ${label}`);
        }
        return text;
    }

    private static extractDhlError(error: any) {
        const data = error.response?.data;
        const item = data?.items?.[0];
        const validation = item?.validationMessages?.[0];
        return validation?.validationMessage
            || validation?.message
            || item?.status?.detail
            || item?.status?.title
            || data?.detail
            || data?.title
            || error.message
            || 'Failed to generate label';
    }

    private static getShipper() {
        return {
            name1: process.env.DHL_SHIPPER_NAME || 'EpicTec Store',
            addressStreet: process.env.DHL_SHIPPER_STREET || 'Musterstr.',
            addressHouse: process.env.DHL_SHIPPER_HOUSE || '1',
            postalCode: process.env.DHL_SHIPPER_ZIP || '12345',
            city: process.env.DHL_SHIPPER_CITY || 'Berlin',
            country: process.env.DHL_SHIPPER_COUNTRY || 'DEU'
        };
    }

    private static async buildShipmentPayload(orderId: string) {
        const creds = this.getCredentials();

        if (!creds.user || !creds.pass || !creds.clientId || !creds.billingNumber) {
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
        const splitAddress = this.splitStreetAndHouse(addr.street, addr.house_number);
        const receiverName = [
            addr.first_name,
            addr.last_name
        ].filter(Boolean).join(' ').trim() || addr.company || order.customer?.first_name || order.customer?.last_name;

        const consignee = {
            name1: this.requiredAddressValue(receiverName, 'customer name'),
            addressStreet: this.requiredAddressValue(splitAddress.street, 'street'),
            addressHouse: this.requiredAddressValue(splitAddress.house, 'house number'),
            postalCode: this.requiredAddressValue(addr.zip, 'postal code'),
            city: this.requiredAddressValue(addr.city, 'city'),
            country: addr.country_code === 'DEU' ? 'DEU' : 'DEU'
        };
        
        // 3. Prepare DHL API Payload
        const payload = {
            profile: "STANDARD_GRUPPENPROFIL",
            shipments: [
                {
                    product: versandart,
                    billingNumber: creds.billingNumber,
                    refNo: order.order_number,
                    shipper: this.getShipper(),
                    consignee,
                    details: {
                        dim: { uom: "mm", length: 300, width: 200, height: 150 }, // Default dimensions
                        weight: { uom: "kg", value: totalWeight }
                    }
                }
            ]
        };

        return { creds, order, payload };
    }

    static async validateLabel(orderId: string) {
        console.log(`[DHL Service] Validating label for Order ID: ${orderId}`);
        const { creds, payload } = await this.buildShipmentPayload(orderId);

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

            const result = response.data?.items?.[0];
            return {
                success: response.status < 400,
                status: response.status,
                dhlStatus: response.data?.status,
                itemStatus: result?.sstatus || result?.status,
                validationMessages: result?.validationMessages || [],
                diagnostics: {
                    billingNumberLength: String(creds.billingNumber || '').length,
                    billingNumberLast4: String(creds.billingNumber || '').slice(-4),
                    shipperConfigured: Boolean(process.env.DHL_SHIPPER_NAME && process.env.DHL_SHIPPER_STREET && process.env.DHL_SHIPPER_HOUSE && process.env.DHL_SHIPPER_ZIP && process.env.DHL_SHIPPER_CITY)
                }
            };
        } catch (error: any) {
            console.error("[DHL Validate Error]", error.response?.data || error.message);
            throw new Error(this.extractDhlError(error));
        }
    }

    static async generateLabel(orderId: string) {
        console.log(`[DHL Service] Generating label for Order ID: ${orderId}`);
        const { creds, payload } = await this.buildShipmentPayload(orderId);

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
            const resultStatus = result?.sstatus || result?.status;
            if (!result || resultStatus?.status >= 400 || resultStatus?.title === "Error") {
                const errMsg = result?.validationMessages?.[0]?.validationMessage || resultStatus?.detail || resultStatus?.title || "Unknown DHL Error";
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
            throw new Error(this.extractDhlError(error));
        }
    }
}
