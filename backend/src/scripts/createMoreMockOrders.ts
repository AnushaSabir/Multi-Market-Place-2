const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createMoreOrders() {
    console.log("Creating mock orders for testing...");
    
    // 1. Create a dummy customer
    const { data: customer, error: cErr } = await supabase.from('customers').insert({
        email: 'test2@epictec.de',
        first_name: 'Sara',
        last_name: 'Ahmed',
        phone: '+49987654321'
    }).select().single();

    if (cErr) {
        console.log("Customer exist, fetching instead...");
    }
    
    const customerId = customer ? customer.id : (await supabase.from('customers').select('id').limit(1).single()).data.id;

    // 2. Create address
    const { data: address } = await supabase.from('addresses').insert({
        customer_id: customerId,
        address_type: 'delivery',
        first_name: 'Sara',
        last_name: 'Ahmed',
        street: 'Neue Straße',
        house_number: '45',
        zip: '80331',
        city: 'München',
        country_code: 'DE'
    }).select().single();

    // 3. Create Orders
    const orderNumbers = ['DEMO-2002', 'DEMO-2003'];
    for (let num of orderNumbers) {
        const { data: order } = await supabase.from('orders').insert({
            order_number: num,
            marketplace: 'kaufland',
            customer_id: customerId,
            invoice_address_id: address.id,
            delivery_address_id: address.id,
            state: 'paid',
            total_price: num === 'DEMO-2002' ? 99.99 : 25.50,
            currency: 'EUR'
        }).select().single();

        // 4. Create Items
        if (num === 'DEMO-2002') {
            // Multi-item order
            await supabase.from('order_items').insert([
                { order_id: order.id, title: 'Test Product A', sku: 'SKU-A', quantity: 2, unit_price: 25.00 },
                { order_id: order.id, title: 'Test Product B', sku: 'SKU-B', quantity: 1, unit_price: 49.99 }
            ]);
        } else {
            // Single item order
            await supabase.from('order_items').insert([
                { order_id: order.id, title: 'Test Product C', sku: 'SKU-C', quantity: 1, unit_price: 25.50 }
            ]);
        }
    }
    console.log("Successfully created DEMO-2002 and DEMO-2003!");
}

createMoreOrders();
