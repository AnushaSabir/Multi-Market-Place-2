import { supabase } from '../database/supabaseClient';

export class CancellationService {
    static async cancelOrder(orderId: string, reason: string = 'Customer Cancellation') {
        try {
            // 1. Fetch order and its items
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('state, items:order_items(*)')
                .eq('id', orderId)
                .single();

            if (orderError) throw new Error(`Failed to fetch order: ${orderError.message}`);
            if (!order) throw new Error('Order not found');

            // Prevent double cancellation or cancelling shipped orders
            if (order.state === 'cancelled') {
                return { success: false, message: 'Order is already cancelled' };
            }
            if (order.state === 'shipped') {
                return { success: false, message: 'Cannot cancel a shipped order' };
            }

            // 2. Restock Inventory
            // Whether it's 'paid' or 'picked', the stock was committed. 
            // We need to add the quantities back to our central inventory.
            for (const item of order.items) {
                // Find product by SKU
                const { data: product } = await supabase
                    .from('products')
                    .select('id, stock_level')
                    .eq('sku', item.sku)
                    .single();

                if (product) {
                    const newStock = (product.stock_level || 0) + item.quantity;
                    await supabase
                        .from('products')
                        .update({ stock_level: newStock })
                        .eq('id', product.id);
                    console.log(`[Cancellation] Restocked SKU ${item.sku} by ${item.quantity}. New Stock: ${newStock}`);
                } else {
                    console.log(`[Cancellation] Product SKU ${item.sku} not found in inventory. Skipping restock.`);
                }
            }

            // 3. Update order state to 'cancelled'
            const { error: updateError } = await supabase
                .from('orders')
                .update({ state: 'cancelled' })
                .eq('id', orderId);

            if (updateError) throw new Error(`Failed to update order state: ${updateError.message}`);

            console.log(`[Cancellation] Order ${orderId} successfully cancelled.`);
            return { success: true, message: 'Order cancelled and stock updated' };

        } catch (error: any) {
            console.error('[Cancellation Error]', error);
            throw error;
        }
    }
}
