import { supabase } from '../database/supabaseClient';

export class OrderSyncService {
    
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
            
            // Check if exists
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('order_number', orderNumber)
                .eq('marketplace', 'shopify')
                .single();

            if (existingOrder) {
                console.log(`[OrderSync] Shopify order ${orderNumber} already exists. Skipping creation.`);
                return { success: true, message: 'Already exists' };
            }

            const { data: newOrder, error: orderErr } = await supabase
                .from('orders')
                .insert({
                    order_number: orderNumber,
                    marketplace: 'shopify',
                    customer_id: customerId,
                    invoice_address_id: invoiceAddrId,
                    delivery_address_id: deliveryAddrId,
                    state: payload.financial_status === 'paid' ? 'paid' : 'pending',
                    total_price: parseFloat(payload.total_price || '0'),
                    currency: payload.currency || 'EUR'
                }).select('id').single();

            if (orderErr || !newOrder) {
                throw new Error(orderErr?.message || 'Failed to create order record');
            }

            // 4. Create Order Items
            const lineItems = payload.line_items || [];
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
}
