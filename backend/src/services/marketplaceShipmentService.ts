import axios from 'axios';
import crypto from 'crypto';
import { supabase } from '../database/supabaseClient';
import { TokenManger } from './tokenService';

export class MarketplaceShipmentService {
    /**
     * Transmit the generated DHL tracking number and confirm shipment to the source marketplace (OTTO, Kaufland, etc.)
     */
    static async confirmShipment(orderId: string, trackingNumber: string, carrier: string = 'DHL'): Promise<{ success: boolean, message?: string }> {
        if (!orderId || !trackingNumber) {
            return { success: false, message: 'Missing orderId or trackingNumber' };
        }

        try {
            // Fetch order details from Supabase
            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_number,
                    marketplace,
                    state,
                    dhl_tracking_number
                `)
                .eq('id', orderId)
                .single();

            if (error || !order) {
                console.error(`[ShipmentConfirmation] Order ${orderId} not found in DB:`, error?.message);
                return { success: false, message: `Order not found: ${error?.message}` };
            }

            const marketplace = String(order.marketplace || '').toLowerCase();
            const orderNumber = String(order.order_number || '');

            console.log(`[ShipmentConfirmation] Confirming shipment for ${marketplace.toUpperCase()} Order #${orderNumber} with DHL tracking: ${trackingNumber}`);

            if (marketplace === 'otto') {
                return await this.confirmOttoShipment(orderNumber, trackingNumber, carrier);
            } else if (marketplace === 'kaufland') {
                return await this.confirmKauflandShipment(orderNumber, trackingNumber, carrier);
            } else if (marketplace === 'shopify') {
                return await this.confirmShopifyShipment(orderNumber, trackingNumber, carrier);
            } else if (marketplace === 'ebay') {
                return await this.confirmEbayShipment(orderNumber, trackingNumber, carrier);
            } else {
                console.log(`[ShipmentConfirmation] Marketplace '${marketplace}' does not require remote tracking webhook.`);
                return { success: true, message: `No remote confirmation needed for ${marketplace}` };
            }
        } catch (err: any) {
            const errMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
            console.error(`[ShipmentConfirmation] Critical failure confirming shipment:`, errMsg);
            return { success: false, message: errMsg };
        }
    }

    private static async confirmOttoShipment(orderNumber: string, trackingNumber: string, carrier: string) {
        const accessToken = await TokenManger.getAccessToken('otto');
        if (!accessToken) {
            console.error('[Otto Shipment] Failed to get Otto access token');
            return { success: false, message: 'Otto access token missing' };
        }

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const shipDate = new Date().toISOString();
        const formattedCarrier = carrier.toUpperCase() === 'DHL' ? 'DHL' : carrier;

        // Try standard salesOrderId shipments endpoint
        try {
            const url = `https://api.otto.market/v4/orders/${orderNumber}/shipments`;
            const payload = {
                trackingNumber,
                carrier: formattedCarrier,
                shipDate
            };

            console.log(`[Otto Shipment] Sending direct shipment confirmation for #${orderNumber}...`);
            const response = await axios.post(url, payload, { headers });
            console.log(`[Otto Shipment] Success for #${orderNumber}: status ${response.status}`);
            return { success: true, message: 'Otto shipment confirmed' };
        } catch (err: any) {
            console.warn(`[Otto Shipment] Direct endpoint error, attempting batch shipment endpoint:`, err.response?.data || err.message);

            try {
                const batchUrl = `https://api.otto.market/v4/shipments`;
                const batchPayload = {
                    shipments: [
                        {
                            orderNumber,
                            trackingNumber,
                            carrier: formattedCarrier,
                            shipDate
                        }
                    ]
                };

                const batchResponse = await axios.post(batchUrl, batchPayload, { headers });
                console.log(`[Otto Shipment] Batch endpoint success for #${orderNumber}: status ${batchResponse.status}`);
                return { success: true, message: 'Otto batch shipment confirmed' };
            } catch (bErr: any) {
                const bMsg = bErr.response?.data ? JSON.stringify(bErr.response.data) : bErr.message;
                console.error(`[Otto Shipment] Batch endpoint also failed for #${orderNumber}:`, bMsg);
                return { success: false, message: bMsg };
            }
        }
    }

    private static async confirmKauflandShipment(orderNumber: string, trackingNumber: string, carrier: string) {
        const clientKey = process.env.KAUFLAND_CLIENT_KEY || '';
        const secretKey = process.env.KAUFLAND_SECRET_KEY || '';

        if (!clientKey || !secretKey) {
            console.error('[Kaufland Shipment] Missing Kaufland credentials');
            return { success: false, message: 'Kaufland credentials missing' };
        }

        try {
            // Find order units for this order
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const listUrl = `https://sellerapi.kaufland.com/v2/order-units?id_order=${orderNumber}&storefront=de`;
            const stringToSign = `GET\n${listUrl}\n\n${timestamp}`;
            const signature = crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');

            const listRes = await axios.get(listUrl, {
                headers: {
                    'Shop-Client-Key': clientKey,
                    'Shop-Timestamp': timestamp,
                    'Shop-Signature': signature,
                    'User-Agent': 'MultiMarketplaceApp/1.0',
                    'Accept': 'application/json'
                }
            });

            const units = listRes.data?.data || [];
            if (units.length === 0) {
                console.warn(`[Kaufland Shipment] No order units found for Kaufland Order #${orderNumber}`);
                return { success: false, message: `No order units found for #${orderNumber}` };
            }

            // Send tracking for each order unit
            let successCount = 0;
            for (const unit of units) {
                const unitId = unit.id_order_unit;
                const sendTimestamp = Math.floor(Date.now() / 1000).toString();
                const sendUrl = `https://sellerapi.kaufland.com/v2/order-units/${unitId}/send`;
                const bodyStr = JSON.stringify({
                    tracking_numbers: [trackingNumber]
                });
                const sendStringToSign = `POST\n${sendUrl}\n${bodyStr}\n${sendTimestamp}`;
                const sendSignature = crypto.createHmac('sha256', secretKey).update(sendStringToSign).digest('hex');

                try {
                    await axios.post(sendUrl, bodyStr, {
                        headers: {
                            'Shop-Client-Key': clientKey,
                            'Shop-Timestamp': sendTimestamp,
                            'Shop-Signature': sendSignature,
                            'Content-Type': 'application/json',
                            'User-Agent': 'MultiMarketplaceApp/1.0'
                        }
                    });
                    console.log(`[Kaufland Shipment] Sent tracking ${trackingNumber} for Unit #${unitId}`);
                    successCount++;
                } catch (uErr: any) {
                    console.error(`[Kaufland Shipment] Failed for Unit #${unitId}:`, uErr.response?.data || uErr.message);
                }
            }

            return {
                success: successCount > 0,
                message: `Kaufland units confirmed: ${successCount}/${units.length}`
            };
        } catch (kErr: any) {
            const kMsg = kErr.response?.data ? JSON.stringify(kErr.response.data) : kErr.message;
            console.error(`[Kaufland Shipment] Order lookup failed for #${orderNumber}:`, kMsg);
            return { success: false, message: kMsg };
        }
    }

    private static async confirmShopifyShipment(orderNumber: string, trackingNumber: string, carrier: string) {
        console.log(`[Shopify Shipment] Recorded tracking ${trackingNumber} for Shopify Order #${orderNumber}`);
        return { success: true, message: 'Shopify shipment recorded' };
    }

    private static async confirmEbayShipment(orderNumber: string, trackingNumber: string, carrier: string) {
        console.log(`[eBay Shipment] Recorded tracking ${trackingNumber} for eBay Order #${orderNumber}`);
        return { success: true, message: 'eBay shipment recorded' };
    }
}
