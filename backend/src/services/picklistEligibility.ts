export type MarketplaceName = 'otto' | 'ebay' | 'kaufland' | 'shopify' | string;

type PicklistOrder = {
    order_number?: string | null;
    marketplace?: MarketplaceName | null;
    state?: string | null;
    created_at?: string | null;
    items?: any[] | null;
};

const DEFAULT_LOOKBACK_DAYS = 14;
const NON_PICKABLE_STATES = new Set(['pending', 'cancelled', 'canceled', 'shipped', 'sent', 'fulfilled', 'picked']);

function configuredList(name: string) {
    return (process.env[name] || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
}

export function getPicklistLookbackDays() {
    const value = Number(process.env.PICKLIST_LOOKBACK_DAYS || DEFAULT_LOOKBACK_DAYS);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_LOOKBACK_DAYS;
}

export function getPicklistCutoffDate() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - getPicklistLookbackDays());
    return cutoff;
}

export function isConfiguredExcludedOrder(order: PicklistOrder) {
    const orderNumber = String(order.order_number || '').trim();
    const marketplace = String(order.marketplace || '').trim().toLowerCase();
    const exact = configuredList('PICKLIST_EXCLUDED_ORDER_NUMBERS');
    const prefixes = configuredList('PICKLIST_EXCLUDED_ORDER_PREFIXES');

    if (exact.includes(orderNumber)) return true;
    if (prefixes.some(prefix => orderNumber.startsWith(prefix))) return true;

    // Demo Shopify seed orders pollute the picklist but are not part of Billbee's ready list.
    if (marketplace === 'shopify' && /^#10\d{2}$/.test(orderNumber)) return true;

    return false;
}

export function isPicklistEligibleOrder(order: PicklistOrder) {
    const state = String(order.state || '').toLowerCase();

    if (NON_PICKABLE_STATES.has(state)) return false;
    if (isConfiguredExcludedOrder(order)) return false;
    if (!order.items || order.items.length === 0) return false;
    return state === 'paid' || state === 'ready_to_ship' || state === 'ready_to_pick';
}

export function mapOttoOrderState(status?: string | null) {
    const normalized = String(status || '').toUpperCase();
    if (['SENT', 'SHIPPED', 'FULFILLED'].includes(normalized)) return 'shipped';
    if (['CANCELLED', 'CANCELED', 'CANCELLED_BY_MARKETPLACE', 'CANCELLED_BY_PARTNER', 'RETURNED', 'ANNOUNCED_BY_PARTNER'].includes(normalized)) return 'cancelled';
    if (['PROCESSABLE', 'ANNOUNCED', 'NEW', 'OPEN', 'ACCEPTED', 'PAID'].includes(normalized)) return 'paid';

    // OTTO's API variants differ between environments. Unknown non-terminal orders should
    // still surface for picking rather than silently disappearing from the warehouse app.
    return status ? 'paid' : 'pending';
}

export function mapShopifyOrderState(order: any) {
    if (order.cancelled_at || order.cancel_reason) return 'cancelled';
    if (String(order.fulfillment_status || '').toLowerCase() === 'fulfilled') return 'shipped';
    return order.financial_status === 'paid' ? 'paid' : 'pending';
}

export function isShopifyOrderImportable(order: any) {
    return mapShopifyOrderState(order) === 'paid' && !isConfiguredExcludedOrder({
        order_number: order.name || String(order.id || ''),
        marketplace: 'shopify',
        state: mapShopifyOrderState(order),
        created_at: order.created_at || order.processed_at,
        items: order.line_items || []
    });
}

export function mapKauflandOrderState(status?: string | null) {
    const normalized = String(status || '').toLowerCase();
    if (['sent', 'shipped', 'sent_and_autopaid'].includes(normalized)) return 'shipped';
    if (['cancelled', 'canceled', 'returned'].includes(normalized)) return 'cancelled';
    if (['need_to_be_sent'].includes(normalized)) return 'paid';
    return 'pending';
}
