import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDemoOrder() {
    console.log("Creating demo order...");

    // 1. Create a dummy customer
    const { data: customer, error: cErr } = await supabase.from('customers').insert({
        email: 'test@epictec.de',
        first_name: 'Max',
        last_name: 'Mustermann',
        phone: '+49123456789'
    }).select().single();

    if (cErr) {
        console.error("Customer Error:", cErr);
        return;
    }

    // 2. Create a dummy delivery address
    const { data: address, error: aErr } = await supabase.from('addresses').insert({
        customer_id: customer.id,
        address_type: 'delivery',
        first_name: 'Max',
        last_name: 'Mustermann',
        street: 'Musterstraße',
        house_number: '12',
        zip: '10115',
        city: 'Berlin',
        country_code: 'DE'
    }).select().single();

    if (aErr) {
        console.error("Address Error:", aErr);
        return;
    }

    // 3. Create an order
    const orderNumber = `DEMO-${Date.now()}`;
    const { data: order, error: oErr } = await supabase.from('orders').insert({
        order_number: orderNumber,
        marketplace: 'shopify',
        customer_id: customer.id,
        invoice_address_id: address.id,
        delivery_address_id: address.id,
        state: 'paid',
        total_price: 49.99,
        currency: 'EUR'
    }).select().single();

    if (oErr) {
        console.error("Order Error:", oErr);
        return;
    }

    // 4. Create an order item (dummy product)
    const { error: iErr } = await supabase.from('order_items').insert({
        order_id: order.id,
        title: 'Demo Product (VIVITAR)',
        sku: 'VIV-12345',
        quantity: 1,
        unit_price: 49.99
    });

    if (iErr) {
        console.error("Order Item Error:", iErr);
        return;
    }

    console.log(`Demo Order created successfully! Order Number: ${orderNumber}`);
}

createDemoOrder();
