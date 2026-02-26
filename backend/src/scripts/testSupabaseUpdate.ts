
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testSupabaseUpdate() {
    const productId = '40125b3b-e857-4f49-b7c8-99234b347815';
    const updates = {
        id: productId,
        price: 14.99,
        title: "Test Title"
    };

    console.log("Attempting to update Supabase with ID in payload...");
    const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

    if (error) {
        console.error("Supabase Error:", error.message);
    } else {
        console.log("Supabase update SUCCESS!");
    }
}

testSupabaseUpdate();
