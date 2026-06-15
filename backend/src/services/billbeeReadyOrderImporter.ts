import axios from 'axios';
import { OrderSyncService, ParsedOrder } from './orderSyncService';
import { getPicklistLookbackDays } from './picklistEligibility';
import { supabase } from '../database/supabaseClient';

const BILLBEE_BASE_URLS = [
    process.env.BILLBEE_BASE_URL || 'https://api.billbee.io/api/v1',
    'https://app.billbee.io/api/v1'
];

function requiredEnv(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function billbeeAuthHeaders() {
    const username = requiredEnv('BILLBEE_USERNAME');
    const password = requiredEnv('BILLBEE_PASS');
    const apiKey = requiredEnv('BILLBEE_API_KEY');
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    return {
        Authorization: `Basic ${auth}`,
        'X-Billbee-Api-Key': apiKey,
        Accept: 'application/json'
    };
}

function getShop(order: any) {
    return order.ShopName || order.Seller || order.Shop || order.ShopInfo || {};
}

function mapMarketplace(order: any) {
    const shop = getShop(order);
    const text = [
        typeof shop === 'string' ? shop : '',
        shop.Platform,
        shop.BillbeeShopName,
        order.Marketplace,
        order.Platform
    ].filter(Boolean).join(' ').toLowerCase();

    if (text.includes('otto')) return 'otto';
    if (text.includes('kaufland')) return 'kaufland';
    if (text.includes('shopify')) return 'shopify';
    if (text.includes('ebay')) return 'ebay';
    return 'billbee';
}

function getOrderNumber(order: any) {
    return String(order.OrderNumber || order.ExternalOrderNumber || order.ExternalId || order.Id);
}

function getCreatedAt(order: any) {
    return order.CreatedAt || order.OrderDate || order.PaidAt || order.PayDate || new Date().toISOString();
}

function getItems(order: any) {
    return order.OrderItems || order.Items || order.Positions || order.OrderPositions || [];
}

function getItemSku(item: any) {
    return item.Product?.SKU
        || item.Product?.Sku
        || item.ArticleNumber
        || item.SKU
        || item.Sku
        || item.Title
        || item.Name
        || item.ProductName
        || item.InvoiceText
        || 'UNKNOWN';
}

function getItemTitle(item: any) {
    return item.Product?.Title
        || item.Title
        || item.Name
        || item.ProductName
        || item.InvoiceText
        || getItemSku(item);
}

function getShippingProvider(order: any) {
    return order.ShippingProviderName
        || order.ShippingProviderProductName
        || order.ShippingProductName
        || order.ShippingProviderId
        || order.ShippingProviderProductId
        || order.Shipment?.ShippingProviderName
        || null;
}

async function fetchBillbeeReadyOrders() {
    const days = getPicklistLookbackDays();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - days);

    const orders: any[] = [];
    let page = 1;
    let activeBaseUrl = BILLBEE_BASE_URLS[0];

    while (page <= 20) {
        let response;
        try {
            response = await axios.get(`${activeBaseUrl}/orders`, {
                headers: billbeeAuthHeaders(),
                params: {
                    page,
                    pageSize: 250,
                    minOrderDate: minDate.toISOString(),
                    includePositions: true,
                    orderStateId: 3
                }
            });
        } catch (error: any) {
            const fallbackBaseUrl = BILLBEE_BASE_URLS.find(url => url !== activeBaseUrl);
            if (page === 1 && fallbackBaseUrl && ['ENOTFOUND', 'EAI_AGAIN'].includes(error.code)) {
                activeBaseUrl = fallbackBaseUrl;
                continue;
            }
            throw error;
        }

        const pageOrders = response.data?.Data || response.data?.data || [];
        orders.push(...pageOrders);

        if (pageOrders.length < 250) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 600));
    }

    return orders;
}

export class BillbeeReadyOrderImporter {
    static async importReadyOrders() {
        const billbeeOrders = await fetchBillbeeReadyOrders();
        const readyKeys = new Set<string>();
        let imported = 0;
        let failed = 0;
        const errors: Array<{ order: string, error: string }> = [];

        for (const order of billbeeOrders) {
            const orderNumber = getOrderNumber(order);
            const marketplace = mapMarketplace(order);
            readyKeys.add(`${marketplace}:${orderNumber}`);
            const parsed: ParsedOrder = {
                order_number: orderNumber,
                marketplace,
                created_at: getCreatedAt(order),
                customer: {
                    email: order.InvoiceAddress?.Email || order.ShippingAddress?.Email || '',
                    first_name: order.InvoiceAddress?.FirstName || order.ShippingAddress?.FirstName || '',
                    last_name: order.InvoiceAddress?.LastName || order.ShippingAddress?.LastName || '',
                    phone: order.InvoiceAddress?.Phone || order.ShippingAddress?.Phone || ''
                },
                billing_address: {
                    first_name: order.InvoiceAddress?.FirstName || '',
                    last_name: order.InvoiceAddress?.LastName || '',
                    company: order.InvoiceAddress?.Company || '',
                    street: order.InvoiceAddress?.Street || '',
                    house_number: order.InvoiceAddress?.HouseNumber || '',
                    zip: order.InvoiceAddress?.Zip || '',
                    city: order.InvoiceAddress?.City || '',
                    country_code: order.InvoiceAddress?.CountryISO2 || order.InvoiceAddress?.Country || ''
                },
                shipping_address: {
                    first_name: order.ShippingAddress?.FirstName || '',
                    last_name: order.ShippingAddress?.LastName || '',
                    company: order.ShippingAddress?.Company || '',
                    street: order.ShippingAddress?.Street || '',
                    house_number: order.ShippingAddress?.HouseNumber || '',
                    zip: order.ShippingAddress?.Zip || '',
                    city: order.ShippingAddress?.City || '',
                    country_code: order.ShippingAddress?.CountryISO2 || order.ShippingAddress?.Country || ''
                },
                state: 'paid',
                shipping_provider: getShippingProvider(order),
                shipping_product: order.ShippingProviderProductName || order.ShippingProductName || null,
                total_price: Number(order.TotalCost || order.TotalPrice || order.Payments?.[0]?.Amount || 0),
                currency: order.Currency || 'EUR',
                items: getItems(order).map((item: any) => ({
                    title: getItemTitle(item),
                    sku: getItemSku(item),
                    quantity: Number(item.Quantity || item.Amount || item.Qty || 1),
                    unit_price: Number(item.TotalPrice || item.Price || item.UnitPrice || 0)
                }))
            };

            const result = await OrderSyncService.upsertOrder(parsed);
            if (result.success) {
                imported++;
            } else {
                failed++;
                errors.push({ order: orderNumber, error: result.error || 'Unknown error' });
            }
        }

        const mirrored = await this.mirrorPicklistToBillbee(readyKeys);

        return {
            success: failed === 0,
            count: imported,
            mirrored,
            failed,
            errors
        };
    }

    private static async mirrorPicklistToBillbee(readyKeys: Set<string>) {
        if (process.env.BILLBEE_MIRROR_PICKLIST === 'false') return 0;

        const minDate = new Date();
        minDate.setDate(minDate.getDate() - getPicklistLookbackDays());

        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_number, marketplace, state, created_at')
            .in('state', ['paid', 'ready_to_ship', 'ready_to_pick'])
            .gte('created_at', minDate.toISOString());

        if (error) throw new Error(`Failed to load marketplace orders for Billbee mirror: ${error.message}`);

        const staleOrders = (orders || []).filter((order: any) => {
            const key = `${order.marketplace}:${order.order_number}`;
            return !readyKeys.has(key);
        });

        for (const order of staleOrders) {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ state: 'pending', updated_at: new Date().toISOString() })
                .eq('id', order.id);

            if (updateError) throw new Error(`Failed to hide stale order ${order.order_number}: ${updateError.message}`);
        }

        return staleOrders.length;
    }
}
