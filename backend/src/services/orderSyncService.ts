import { supabase } from '../database/supabaseClient';
import { mapShopifyOrderState } from './picklistEligibility';

export interface ParsedOrder {
    order_number: string;
    marketplace: string;
    created_at?: string;
    customer: { email?: string, first_name?: string, last_name?: string, phone?: string };
    billing_address?: { first_name?: string, last_name?: string, company?: string, street?: string, house_number?: string, zip?: string, city?: string, country_code?: string };
    shipping_address?: { first_name?: string, last_name?: string, company?: string, street?: string, house_number?: string, zip?: string, city?: string, country_code?: string };
    state: string; 
    shipping_provider?: string | number | null;
    shipping_product?: string | null;
    total_price: number;
    currency: string;
    items: Array<{ title: string, sku: string, quantity: number, unit_price: number }>;
}


export class OrderSyncService {
    private static async findProductForOrderItem(sku?: string) {
        if (!sku) return null;

        let { data: prod } = await supabase
            .from('products')
            .select('id, sku, title')
            .eq('sku', sku)
            .maybeSingle();

        if (!prod) {
            const { data: prodByEan } = await supabase
                .from('products')
                .select('id, sku, title')
                .eq('ean', sku)
                .maybeSingle();
            prod = prodByEan;
        }

        return prod;
    }

    private static normalizeOrderItem(item: { title?: string, sku?: string, quantity?: number, unit_price?: number, price?: number }, prod: any) {
        let finalSku = item.sku || 'UNKNOWN';
        let finalTitle = item.title || 'UNKNOWN';

        if (prod) {
            finalSku = prod.sku || finalSku;
            const isNumericSku = prod.sku && /^\d+$/.test(prod.sku);
            finalTitle = (!isNumericSku && prod.sku) ? prod.sku : (prod.title || finalTitle);
        }

        return {
            product_id: prod?.id || null,
            title: finalTitle,
            sku: finalSku,
            quantity: item.quantity || 1,
            unit_price: item.unit_price ?? item.price ?? 0
        };
    }

    private static async replaceOrderItems(orderId: string, items: Array<{ title?: string, sku?: string, quantity?: number, unit_price?: number, price?: number }>) {
        if (!items || items.length === 0) return;

        const { error: deleteErr } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId);

        if (deleteErr) throw new Error(`Failed to refresh order items: ${deleteErr.message}`);

        for (const item of items) {
            const prod = await this.findProductForOrderItem(item.sku);
            const normalizedItem = this.normalizeOrderItem(item, prod);

            const { error: insertErr } = await supabase.from('order_items').insert({
                order_id: orderId,
                ...normalizedItem
            });

            if (insertErr) {
                console.error('FAILED TO INSERT ITEM:', item.sku, normalizedItem.sku, insertErr);
            }
        }
    }
    
    /**
     * Map a Shopify Order Webhook to Billbee Structure and save to DB
     */
    static async handleShopifyOrder(payload: any) {
        console.log(`[OrderSync] Processing Shopify Order: ${payload.id || payload.name}`);
        
        try {
            // 1. Extract Customer
            const customerData = payload.customer || {};
            const email = customerData.email || payload.contact_email || '';
            const firstName = customerData.first_name || '';
            const lastName = customerData.last_name || '';
            const phone = customerData.phone || payload.phone || '';

            // Upsert Customer by Email (simplified for MVP)
            let customerId = null;
            if (email) {
                const { data: existingCust } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('email', email)
                    .single();
                
                if (existingCust) {
                    customerId = existingCust.id;
                } else {
                    const { data: newCust, error: custErr } = await supabase
                        .from('customers')
                        .insert({ email, first_name: firstName, last_name: lastName, phone })
                        .select('id')
                        .single();
                    if (!custErr && newCust) customerId = newCust.id;
                }
            }

            // 2. Extract Addresses
            const billing = payload.billing_address || {};
            const shipping = payload.shipping_address || billing;

            let invoiceAddrId = null;
            let deliveryAddrId = null;

            if (customerId && billing.address1) {
                const { data: invAddr } = await supabase.from('addresses').insert({
                    customer_id: customerId,
                    address_type: 'invoice',
                    first_name: billing.first_name,
                    last_name: billing.last_name,
                    company: billing.company,
                    street: billing.address1,
                    house_number: billing.address2, // Shopify combines, but fallback
                    zip: billing.zip,
                    city: billing.city,
                    country_code: billing.country_code
                }).select('id').single();
                if (invAddr) invoiceAddrId = invAddr.id;

                const { data: delAddr } = await supabase.from('addresses').insert({
                    customer_id: customerId,
                    address_type: 'delivery',
                    first_name: shipping.first_name,
                    last_name: shipping.last_name,
                    company: shipping.company,
                    street: shipping.address1,
                    house_number: shipping.address2,
                    zip: shipping.zip,
                    city: shipping.city,
                    country_code: shipping.country_code
                }).select('id').single();
                if (delAddr) deliveryAddrId = delAddr.id;
            }

            // 3. Create Order
            const orderNumber = payload.name || String(payload.id); // e.g. #1001
            const orderCreatedAt = payload.created_at || payload.processed_at || new Date().toISOString();
            
            // Check if exists
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('order_number', orderNumber)
                .eq('marketplace', 'shopify')
                .single();

            const lineItems = payload.line_items || [];

            if (existingOrder) {
                await supabase.from('orders').update({
                    customer_id: customerId,
                    invoice_address_id: invoiceAddrId,
                    delivery_address_id: deliveryAddrId,
                    state: mapShopifyOrderState(payload),
                    total_price: parseFloat(payload.total_price || '0'),
                    currency: payload.currency || 'EUR',
                    created_at: orderCreatedAt,
                    updated_at: new Date().toISOString()
                }).eq('id', existingOrder.id);

                await this.replaceOrderItems(existingOrder.id, lineItems.map((item: any) => ({
                    title: item.title,
                    sku: item.sku || 'UNKNOWN',
                    quantity: item.quantity || 1,
                    unit_price: parseFloat(item.price || '0')
                })));

                console.log(`[OrderSync] Refreshed existing Shopify order ${orderNumber}.`);
                return { success: true, message: 'Updated existing order' };
            }

            const { data: newOrder, error: orderErr } = await supabase
                .from('orders')
                .insert({
                    order_number: orderNumber,
                    marketplace: 'shopify',
                    customer_id: customerId,
                    invoice_address_id: invoiceAddrId,
                    delivery_address_id: deliveryAddrId,
                    state: mapShopifyOrderState(payload),
                    total_price: parseFloat(payload.total_price || '0'),
                    currency: payload.currency || 'EUR',
                    created_at: orderCreatedAt
                }).select('id').single();

            if (orderErr || !newOrder) {
                throw new Error(orderErr?.message || 'Failed to create order record');
            }

            // 4. Create Order Items
            for (const item of lineItems) {
                // Find internal product ID by SKU
                const sku = item.sku;
                let internalProductId = null;
                
                if (sku) {
                    const { data: prod } = await supabase
                        .from('products')
                        .select('id')
                        .eq('sku', sku)
                        .single();
                    if (prod) internalProductId = prod.id;
                }

                await supabase.from('order_items').insert({
                    order_id: newOrder.id,
                    product_id: internalProductId,
                    title: item.title,
                    sku: item.sku || 'UNKNOWN',
                    quantity: item.quantity || 1,
                    unit_price: parseFloat(item.price || '0')
                });
            }

            console.log(`[OrderSync] Successfully synced Shopify order ${orderNumber}`);
            return { success: true };

        } catch (error: any) {
            console.error(`[OrderSync] Error syncing Shopify order: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generic Mock Handler for MVP Testing
     */
    static async handleGenericOrder(marketplace: string, payload: any) {
        // Very basic fallback
        const orderNumber = payload.order_id || `MOCK-${Date.now()}`;
        const { data: newOrder } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                marketplace: marketplace,
                total_price: payload.total_price || 0,
                state: 'pending'
            }).select('id').single();
            
        if (newOrder && payload.items && Array.isArray(payload.items)) {
            for (const item of payload.items) {
                await supabase.from('order_items').insert({
                    order_id: newOrder.id,
                    title: item.title || 'Item',
                    sku: item.sku || 'SKU',
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0
                });
            }
        }
    }

    /**
     * Universal method to upsert an order from any marketplace
     */
    static async upsertOrder(order: ParsedOrder) {
        console.log(`[OrderSync] Upserting Order ${order.order_number} from ${order.marketplace}`);
        
        try {
            // 1. Customer
            let customerId = null;
            if (order.customer.email) {
                const { data: existingCust } = await supabase.from('customers').select('id').eq('email', order.customer.email).single();
                if (existingCust) {
                    customerId = existingCust.id;
                } else {
                    const { data: newCust, error } = await supabase.from('customers').insert(order.customer).select('id').single();
                    if (!error && newCust) customerId = newCust.id;
                }
            }

            // 2. Addresses
            let invoiceAddrId = null;
            let deliveryAddrId = null;

            if (customerId && order.billing_address && order.billing_address.street) {
                const { data: invAddr } = await supabase.from('addresses').insert({
                    customer_id: customerId,
                    address_type: 'invoice',
                    ...order.billing_address
                }).select('id').single();
                if (invAddr) invoiceAddrId = invAddr.id;
            }

            if (customerId && order.shipping_address && order.shipping_address.street) {
                const { data: delAddr } = await supabase.from('addresses').insert({
                    customer_id: customerId,
                    address_type: 'delivery',
                    ...order.shipping_address
                }).select('id').single();
                if (delAddr) deliveryAddrId = delAddr.id;
            } else if (invoiceAddrId) {
                deliveryAddrId = invoiceAddrId; // Fallback
            }

            // 3. Order
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('order_number', order.order_number)
                .eq('marketplace', order.marketplace)
                .maybeSingle();

            if (existingOrder) {
                const updatePayload: any = {
                    state: order.state,
                    total_price: order.total_price,
                    currency: order.currency,
                    created_at: order.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                if (customerId) updatePayload.customer_id = customerId;
                if (invoiceAddrId) updatePayload.invoice_address_id = invoiceAddrId;
                if (deliveryAddrId) updatePayload.delivery_address_id = deliveryAddrId;
                if (order.shipping_provider) updatePayload.shipping_provider = String(order.shipping_provider);
                if (order.shipping_product) updatePayload.shipping_product = order.shipping_product;

                const { error: updateErr } = await supabase
                    .from('orders')
                    .update(updatePayload)
                    .eq('id', existingOrder.id);

                if (updateErr) throw new Error(updateErr.message);

                await this.replaceOrderItems(existingOrder.id, order.items);
                return { success: true, message: 'Updated existing order' };
            }

            const { data: newOrder, error: orderErr } = await supabase.from('orders').insert({
                order_number: order.order_number,
                marketplace: order.marketplace,
                customer_id: customerId,
                invoice_address_id: invoiceAddrId,
                delivery_address_id: deliveryAddrId,
                state: order.state,
                shipping_provider: order.shipping_provider ? String(order.shipping_provider) : null,
                shipping_product: order.shipping_product || null,
                total_price: order.total_price,
                currency: order.currency,
                created_at: order.created_at || new Date().toISOString()
            }).select('id').single();

            if (orderErr || !newOrder) throw new Error(orderErr?.message || 'Failed to create order');

            // 4. Items
            await this.replaceOrderItems(newOrder.id, order.items);

            return { success: true };
        } catch (error: any) {
            console.error(`[OrderSync] Upsert Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    static async hideStaleOpenOrders(marketplace: string, openOrderNumbers: Set<string>) {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('marketplace', marketplace)
            .in('state', ['paid', 'ready_to_ship', 'ready_to_pick']);

        if (error) throw new Error(`Failed to load active ${marketplace} orders: ${error.message}`);

        const staleIds = (orders || [])
            .filter((order: any) => !openOrderNumbers.has(String(order.order_number)))
            .map((order: any) => order.id);

        if (staleIds.length === 0) return 0;

        const { error: updateError } = await supabase
            .from('orders')
            .update({ state: 'pending', updated_at: new Date().toISOString() })
            .in('id', staleIds);

        if (updateError) throw new Error(`Failed to hide stale ${marketplace} orders: ${updateError.message}`);

        return staleIds.length;
    }
}
