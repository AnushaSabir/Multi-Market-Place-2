const { supabase } = require('../../dist/database/supabaseClient');
const axios = require('axios');
const crypto = require('crypto');

const clientKey = '20689f89b8976c59cc753634e21e2802';
const secretKey = 'a2a448bf65e9c8047ce74c8db71b856152c5caca1dd8983884615522a46d53ff';

async function pushAllKaufland() {
    // 1. Fetch top 50 valid products from Supabase
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .not('ean', 'is', null)
        .neq('ean', '')
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (error) { console.error('Error fetching products:', error); return; }
    console.log('Fetched products to push to Kaufland:', products.length);

    let successCount = 0;
    const pushedList = [];

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const ean = product.ean.trim();
        const sku = product.sku || product.ean;
        const title = product.title || ('Product ' + ean);
        const description = product.description && product.description.length > 20 
            ? product.description 
            : ('<h2>' + title + '</h2><p>Hochwertiges Markenprodukt mit erstklassiger Verarbeitung, hoher Langlebigkeit und modernem Design.</p>');
            
        const images = Array.isArray(product.images) && product.images.length > 0 && product.images[0]
            ? product.images.filter(u => typeof u === 'string' && u.startsWith('http'))
            : (typeof product.images === 'string' && product.images.startsWith('http') ? [product.images] : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80']);
            
        const priceCents = Math.round((product.price && product.price > 5 ? product.price : 29.98) * 100);
        const amount = product.quantity && product.quantity > 0 ? product.quantity : 10;

        try {
            // Step 1: Register Product Data (Title, Description, Pictures, Manufacturer)
            const pdBody = {
                ean: [ean],
                attributes: {
                    title: [title],
                    description: [description],
                    picture: images.length > 0 ? images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'],
                    manufacturer: [product.brand || 'VIVITAR']
                }
            };
            const pdTimestamp = Math.floor(Date.now() / 1000).toString();
            const pdUrl = 'https://sellerapi.kaufland.com/v2/product-data?locale=de-DE';
            const pdBodyStr = JSON.stringify(pdBody);
            const pdSig = crypto.createHmac('sha256', secretKey).update('PUT\n' + pdUrl + '\n' + pdBodyStr + '\n' + pdTimestamp).digest('hex');

            await axios.put(pdUrl, pdBodyStr, {
                headers: {
                    'Shop-Client-Key': clientKey,
                    'Shop-Timestamp': pdTimestamp,
                    'Shop-Signature': pdSig,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            // Step 2: Create / Update Unit Offer
            const unitBody = {
                ean: ean,
                condition: 'NEW',
                listing_price: priceCents,
                amount: amount,
                id_offer: sku,
                handling_time: 2
            };
            const unitTimestamp = Math.floor(Date.now() / 1000).toString();
            const unitUrl = 'https://sellerapi.kaufland.com/v2/units?storefront=de';
            const unitBodyStr = JSON.stringify(unitBody);
            const unitSig = crypto.createHmac('sha256', secretKey).update('POST\n' + unitUrl + '\n' + unitBodyStr + '\n' + unitTimestamp).digest('hex');

            const unitRes = await axios.post(unitUrl, unitBodyStr, {
                headers: {
                    'Shop-Client-Key': clientKey,
                    'Shop-Timestamp': unitTimestamp,
                    'Shop-Signature': unitSig,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const unitId = unitRes.data?.data?.id_unit || unitRes.data?.id_unit || sku;
            console.log('[' + (i+1) + '/' + products.length + '] OK: SKU: ' + sku + ' | EAN: ' + ean + ' | Unit ID: ' + unitId + ' | Title: ' + title.substring(0,35) + '...');
            
            // Step 3: Record in marketplace_products
            await supabase.from('marketplace_products').upsert({
                product_id: product.id,
                marketplace: 'kaufland',
                external_id: unitId.toString(),
                price: priceCents / 100,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString()
            }, { onConflict: 'product_id,marketplace' });

            successCount++;
            pushedList.push({ sku, ean, unitId, title, price: priceCents / 100 });

            // Small delay to prevent rate limits
            await new Promise(r => setTimeout(r, 400));
        } catch (err) {
            console.error('[' + (i+1) + '/' + products.length + '] FAILED: SKU: ' + sku + ' (EAN: ' + ean + ') -', err.response?.data || err.message);
        }
    }

    console.log('\n==============================================');
    console.log('TOTAL PRODUCTS SUCCESSFULLY PUSHED TO KAUFLAND: ' + successCount);
    console.log('==============================================');
}

pushAllKaufland().catch(console.error);
