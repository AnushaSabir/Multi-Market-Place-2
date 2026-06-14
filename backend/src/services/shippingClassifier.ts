export const SMALL_PACKAGE_PROVIDER = 300000000031621;
export const DHL_PROVIDER = 300000000031622;

type ShippingItem = {
    quantity?: number;
    product?: {
        weight?: number | string | null;
        shipping_type?: string | null;
        dhl_versandart?: string | null;
    } | null;
};

export function classifyOrderShipping(items: ShippingItem[] = [], existingProvider?: string | number | null) {
    let totalWeight = 0;
    let totalQuantity = 0;
    let explicitSmallPackage = false;
    let explicitDhl = false;

    for (const item of items) {
        const quantity = Number(item.quantity || 1);
        const rawWeight = Number(item.product?.weight || 0);
        const weight = rawWeight > 0 ? rawWeight : 0.5;
        const configuredShipping = String(item.product?.shipping_type || '').toLowerCase();
        const legacyShipping = String(item.product?.dhl_versandart || '').toLowerCase();

        totalQuantity += quantity;
        totalWeight += weight * quantity;

        if (/small|klein|warenpost|brief/.test(`${configuredShipping} ${legacyShipping}`)) {
            explicitSmallPackage = true;
        }

        if (/dhl|paket|parcel/.test(configuredShipping) && !/small|klein/.test(configuredShipping)) {
            explicitDhl = true;
        }
    }

    const providerFromOrder = existingProvider && String(existingProvider).trim() !== ''
        ? Number(existingProvider)
        : null;

    let isSmallPackage = totalWeight <= 1;

    if (explicitSmallPackage) {
        isSmallPackage = true;
    }

    if (explicitDhl || totalWeight > 1) {
        isSmallPackage = false;
    }

    const calculatedProvider = isSmallPackage ? SMALL_PACKAGE_PROVIDER : DHL_PROVIDER;
    const shippingProvider = providerFromOrder || calculatedProvider;
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
