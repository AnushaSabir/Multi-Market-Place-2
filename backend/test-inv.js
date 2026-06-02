const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOrder() {
    const { data: order, error } = await supabase.from('orders').select('id, order_number').limit(1);
    console.log("Order fetched:", order, error);

    if (order && order[0]) {
        const orderId = order[0].id;
        const { data: orderDetails, error: orderError } = await supabase.from('orders').select('invoice_number, customer:customers(email, first_name, last_name), order_number').eq('id', orderId).single();
        console.log("Invoice Query:", orderDetails, orderError);

        const { data: fullOrder, error: fullError } = await supabase
        .from('orders')
        .select(`
            *,
            customer:customers(*),
            invoice_address:addresses!invoice_address_id(*),
            delivery_address:addresses!delivery_address_id(*),
            items:order_items(*)
        `)
        .eq('id', orderId)
        .single();
        console.log("Full Query Error:", fullError);
    }
}
checkOrder();
