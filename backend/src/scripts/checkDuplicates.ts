import { supabase } from '../database/supabaseClient';

async function checkDuplicates() {
    console.log("Checking for duplicate products (SKU/EAN)...");

    const { data, error } = await supabase
        .from('products')
        .select('id, sku, ean, title');

    if (error) {
        console.error("Error fetching products:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No products found in database.");
        return;
    }

    const skuMap: Record<string, string[]> = {};
    const eanMap: Record<string, string[]> = {};

    data.forEach(p => {
        if (p.sku) {
            if (!skuMap[p.sku]) skuMap[p.sku] = [];
            skuMap[p.sku].push(p.id);
        }
        if (p.ean) {
            if (!eanMap[p.ean]) eanMap[p.ean] = [];
            eanMap[p.ean].push(p.id);
        }
    });

    const dupSkus = Object.entries(skuMap).filter(([_, ids]) => ids.length > 1);
    const dupEans = Object.entries(eanMap).filter(([_, ids]) => ids.length > 1);

    if (dupSkus.length === 0 && dupEans.length === 0) {
        console.log("SUCCESS: No duplicates found. Database is clean.");
    } else {
        console.log("WARNING: Duplicates found!");
        if (dupSkus.length > 0) {
            console.log("Duplicate SKUs:");
            dupSkus.forEach(([sku, ids]) => console.log(`  - SKU ${sku}: [${ids.join(', ')}]`));
        }
        if (dupEans.length > 0) {
            console.log("Duplicate EANs:");
            dupEans.forEach(([ean, ids]) => console.log(`  - EAN ${ean}: [${ids.join(', ')}]`));
        }
    }
}

checkDuplicates();
