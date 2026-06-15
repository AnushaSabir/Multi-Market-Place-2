export const SMALL_PACKAGE_PROVIDER = 300000000031621;
export const DHL_PROVIDER = 300000000031622;

type ShippingItem = {
    title?: string | null;
    sku?: string | null;
    unit_price?: number | string | null;
    quantity?: number;
    product?: {
        title?: string | null;
        sku?: string | null;
        weight?: number | string | null;
        shipping_type?: string | null;
        dhl_versandart?: string | null;
    } | null;
};

const DHL_TITLE_PATTERNS = [
    /bürostuhl|buerostuhl|stuhl/i,
    /laufband/i,
    /massagepistole/i,
    /ultraschallreiniger/i,
    /vacuum cleaner|staubsauger|handsauger(?!\s+klein)|saugroboter|robotstaubsauger/i,
    /wasserhahn/i,
    /schuhe/i,
    /spielball/i,
    /krabbe/i,
    /küche|kueche/i,
    /heizweste/i,
    /projektor\s+topv/i,
    /onefire\s+lpn\s+mini\s+lampe\s+pink/i
];

const SMALL_PACKAGE_TITLE_PATTERNS = [
    /powerbank/i,
    /mikrofonhalter/i,
    /hülle|huelle|case|15p|max\s+lila/i,
    /uhr|watch/i,
    /staratlas/i,
    /lichtkugel|lichterkette/i,
    /pool light/i,
    /kamera|camera|druckkamera/i,
    /elektrorasierer|kopfrasierer/i,
    /flugzeug|spielmatte|nasenreiniger|pet rot|usb|hub/i,
    /handsauger\s+klein/i
];

function itemText(item: ShippingItem) {
    return [
        item.title,
        item.sku,
        item.product?.title,
        item.product?.sku
    ].filter(Boolean).join(' ');
}

export function classifyOrderShipping(items: ShippingItem[] = [], existingProvider?: string | number | null) {
    let totalWeight = 0;
    let totalQuantity = 0;
    let explicitSmallPackage = false;
    let explicitDhl = false;
    let heuristicSmallPackage = false;
    let heuristicDhl = false;
    let providerSmallPackage = false;
    let providerDhl = false;

    const providerText = String(existingProvider || '').toLowerCase();
    if (/small|klein|warenpost|brief|31621/.test(providerText)) {
        explicitSmallPackage = true;
        providerSmallPackage = true;
    }
    if (/dhl|paket|parcel|31622/.test(providerText) && !/small|klein|warenpost|brief|31621/.test(providerText)) {
        explicitDhl = true;
        providerDhl = true;
    }

    for (const item of items) {
        const quantity = Number(item.quantity || 1);
        const rawWeight = Number(item.product?.weight || 0);
        const weight = rawWeight > 0 ? rawWeight : 0.5;
        const configuredShipping = String(item.product?.shipping_type || '').toLowerCase();
        const legacyShipping = String(item.product?.dhl_versandart || '').toLowerCase();
        const text = itemText(item);

        totalQuantity += quantity;
        totalWeight += weight * quantity;

        if (/small|klein|warenpost|brief/.test(`${configuredShipping} ${legacyShipping}`)) {
            explicitSmallPackage = true;
        }

        if (/dhl|paket|parcel/.test(configuredShipping) && !/small|klein/.test(configuredShipping)) {
            explicitDhl = true;
        }

        if (SMALL_PACKAGE_TITLE_PATTERNS.some(pattern => pattern.test(text))) {
            heuristicSmallPackage = true;
        }

        if (DHL_TITLE_PATTERNS.some(pattern => pattern.test(text))) {
            heuristicDhl = true;
        }
    }

    let isSmallPackage = totalWeight <= 1;

    if (providerSmallPackage) {
        isSmallPackage = true;
    } else if (providerDhl) {
        isSmallPackage = false;
    } else if (explicitSmallPackage || heuristicSmallPackage) {
        isSmallPackage = true;
    } else if (explicitDhl || heuristicDhl || totalWeight > 1) {
        isSmallPackage = false;
    }

    const calculatedProvider = isSmallPackage ? SMALL_PACKAGE_PROVIDER : DHL_PROVIDER;
    const shippingProvider = calculatedProvider;
    const providerIsSmallPackage = shippingProvider === SMALL_PACKAGE_PROVIDER;

    return {
        shipping_provider: shippingProvider,
        shipping_product: providerIsSmallPackage ? 'Small Package' : 'DHL Paket',
        dhl_versandart: providerIsSmallPackage ? 'Small Package' : 'DHL Paket',
        shipping_bucket: providerIsSmallPackage ? 'small_package' : 'dhl',
        shipping_weight: totalWeight,
        total_quantity: totalQuantity
    };
}
