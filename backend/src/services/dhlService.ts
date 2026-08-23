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
            name1: process.env.DHL_SHIPPER_NAME || 'Firma EpicTec Thayub',
            addressStreet: process.env.DHL_SHIPPER_STREET || 'Jenneweg',
            addressHouse: process.env.DHL_SHIPPER_HOUSE || '158',
            postalCode: process.env.DHL_SHIPPER_ZIP || '66113',
            city: process.env.DHL_SHIPPER_CITY || 'Saarbrücken',
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
                items:order_items(quantity, unit_price, sku, product:products(sku, weight, dhl_versandart))
            `)
            .eq('id', orderId)
            .single();

        if (error || !order) throw new Error("Order not found or database error");
        if (!order.delivery_address) throw new Error("Delivery address is missing for this order");

        // 2. Calculate Total Weight and Determine Service
        let totalWeight = 0;

        for (const item of (order.items || [])) {
            const weight = (item.product?.weight && item.product.weight > 0) ? item.product.weight : 0.5;
            totalWeight += (weight * (item.quantity || 1));
        }
        if (totalWeight === 0) totalWeight = 0.8; // Standard 0.8kg

        const ekp = process.env.DHL_EKP || (creds.billingNumber ? creds.billingNumber.substring(0, 10) : '6358337079');
        const isKleinpaket = order.shipping_bucket === 'small_package' || totalWeight <= 1.0;
        const versandart = isKleinpaket ? 'V62KP' : 'V01PAK';
        const billingNumber = isKleinpaket
            ? (process.env.DHL_BILLING_NUMBER_KLEINPAKET || `${ekp}6201`)
            : (process.env.DHL_BILLING_NUMBER_PAKET || creds.billingNumber || `${ekp}0102`);

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
        
        const firstItemSku = order.items?.[0]?.product?.sku || order.items?.[0]?.sku || '';
        let safeRefNo = firstItemSku ? String(firstItemSku).trim() : String(order.order_number || '');
        if (safeRefNo.length < 8) {
            safeRefNo = safeRefNo.padEnd(8, ' ');
        } else if (safeRefNo.length > 35) {
            safeRefNo = safeRefNo.substring(0, 35);
        }

        // 3. Prepare DHL API Payload
        const shipmentItem: any = {
            product: versandart,
            billingNumber: billingNumber,
            refNo: safeRefNo,
            shipper: this.getShipper(),
            consignee,
            details: {
                dim: { uom: "mm", length: 300, width: 200, height: 150 }, // Default dimensions
                weight: { uom: "kg", value: Number(totalWeight.toFixed(2)) }
            }
        };

        // For Kleinpaket, include filialRouting service
        if (isKleinpaket) {
            shipmentItem.services = {
                filialrouting: {
                    active: true
                }
            };
        }

        const payload = {
            profile: "STANDARD_GRUPPENPROFIL",
            shipments: [shipmentItem]
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
        const { creds, order, payload } = await this.buildShipmentPayload(orderId);

        if (order.dhl_tracking_number === 'PENDING') {
            throw new Error("Label generation is currently in progress. Please check back in a few minutes or check your DHL business portal.");
        }
        
        if (order.dhl_tracking_number && order.dhl_tracking_number !== 'PENDING') {
            throw new Error(`Label already generated. Tracking: ${order.dhl_tracking_number}`);
        }

        // Lock it to prevent double clicks or timeout retries
        await supabase.from('orders').update({ dhl_tracking_number: 'PENDING' }).eq('id', orderId);

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
            // Revert PENDING state on error
            await supabase.from('orders').update({ dhl_tracking_number: null }).eq('id', orderId);
            console.error("[DHL Error]", error.response?.data || error.message);
            throw new Error(this.extractDhlError(error));
        }
    }
}
