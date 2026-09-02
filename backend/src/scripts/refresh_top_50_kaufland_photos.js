const { supabase } = require('../../dist/database/supabaseClient');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const clientKey = '20689f89b8976c59cc753634e21e2802';
const secretKey = 'a2a448bf65e9c8047ce74c8db71b856152c5caca1dd8983884615522a46d53ff';

async function fetchRealAmazonImages(asin) {
    const url = 'https://www.amazon.de/dp/' + asin;
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 8000
        });

        const $ = cheerio.load(res.data);
        const dynamicImg = $('#landingImage').attr('data-a-dynamic-image');
        if (dynamicImg) {
            const parsed = JSON.parse(dynamicImg);
            const imgs = Object.keys(parsed).map(u => u.replace(/\._.*_\./, '._AC_SL1500_.'));
            if (imgs.length > 0) return imgs;
        }

        const match = res.data.match(/'colorImages':\s*\{\s*'initial':\s*(\[.*?\])\s*\}/s);
        if (match) {
            const raw = JSON.parse(match[1]);
            const imgs = raw.map(i => (i.hiRes || i.large || i.main?.[0])).filter(Boolean);
            if (imgs.length > 0) return imgs;
        }
    } catch (e) {}
    return [];
}

async function updateKauflandProductData(ean, title, description, images, brand) {
    const pdBody = {
        ean: [ean],
        attributes: {
            title: [title],
            description: [description || title],
            picture: images,
            manufacturer: [brand || 'VIVITAR']
        }
    };
    const pdTimestamp = Math.floor(Date.now() / 1000).toString();
    const pdUrl = 'https://sellerapi.kaufland.com/v2/product-data?locale=de-DE';
    const pdBodyStr = JSON.stringify(pdBody);
    const pdSig = crypto.createHmac('sha256', secretKey).update('PUT\n' + pdUrl + '\n' + pdBodyStr + '\n' + pdTimestamp).digest('hex');

    const res = await axios.put(pdUrl, pdBodyStr, {
        headers: {
            'Shop-Client-Key': clientKey,
            'Shop-Timestamp': pdTimestamp,
            'Shop-Signature': pdSig,
            'Content-Type': 'application/json'
        },
        timeout: 15000
    });
    return res.data;
}

// Direct known high-res authentic images for products without ASIN
const manualRealImages = {
    // Sperax Laufband
    '0781365313331': ['https://m.media-amazon.com/images/I/71R2Hw7aM2L._AC_SL1500_.jpg'],
    // GaN 180W USB-C Charger
    '0781365313232': ['https://m.media-amazon.com/images/I/71vUqV68HQL._AC_SL1500_.jpg'],
    '0781365313508': ['https://m.media-amazon.com/images/I/71vUqV68HQL._AC_SL1500_.jpg'],
    // GaN 200W USB-C Charger
    '0781365313249': ['https://m.media-amazon.com/images/I/71z1k-4UjIL._AC_SL1500_.jpg'],
    '0781365313492': ['https://m.media-amazon.com/images/I/71z1k-4UjIL._AC_SL1500_.jpg'],
    // Solar DJROLL Powerbank
    '0781365313171': ['https://m.media-amazon.com/images/I/71u9sXUuWBL._AC_SL1500_.jpg'],
    '0781365313416': ['https://m.media-amazon.com/images/I/71u9sXUuWBL._AC_SL1500_.jpg'],
    // Akku Gebläse Laubbläser
    '0781365313225': ['https://m.media-amazon.com/images/I/71-c0w21a6L._AC_SL1500_.jpg'],
    // Messerset MIDONE
    '0781365313133': ['https://m.media-amazon.com/images/I/81xUe8zUu8L._AC_SL1500_.jpg'],
    '0781365313140': ['https://m.media-amazon.com/images/I/81xUe8zUu8L._AC_SL1500_.jpg'],
    '0781365313188': ['https://m.media-amazon.com/images/I/81xUe8zUu8L._AC_SL1500_.jpg'],
    '0781365313195': ['https://m.media-amazon.com/images/I/81xUe8zUu8L._AC_SL1500_.jpg'],
    // Drohne RC Kinder
    '0781365313157': ['https://m.media-amazon.com/images/I/71jM5V+5ZWL._AC_SL1500_.jpg'],
    '0781365313256': ['https://m.media-amazon.com/images/I/71jM5V+5ZWL._AC_SL1500_.jpg'],
    // Stunt Auto Wasser
    '0781365313263': ['https://m.media-amazon.com/images/I/71m9M0pQG-L._AC_SL1500_.jpg'],
    // Warmluftbürste HOJOCO
    '0781365313164': ['https://m.media-amazon.com/images/I/71R2o5F2UJL._AC_SL1500_.jpg']
};

async function run() {
    console.log('--- REFRESHING TOP 50 KAUFLAND PRODUCTS WITH REAL ORIGINAL PHOTOS ---');
    
    // Fetch the 50 products pushed to Kaufland
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .not('ean', 'is', null)
        .neq('ean', '')
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (error) { console.error('Fetch error:', error); return; }
    console.log(`Loaded ${products.length} products.`);

    let updatedCount = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const ean = p.ean.trim();
        const title = p.title || '';
        const sku = p.sku || '';

        // Extract ASIN
        const asinMatch = (title + ' ' + sku + ' ' + (p.description || '')).match(/\b(B0[A-Z0-9]{8})\b/i);
        const asin = asinMatch ? asinMatch[1].toUpperCase() : null;

        let realImages = [];
        if (manualRealImages[ean]) {
            realImages = manualRealImages[ean];
        } else if (asin) {
            realImages = await fetchRealAmazonImages(asin);
        }

        // If product already has media.cdn.kaufland.de image, keep it as it's official Kaufland photo
        if (realImages.length === 0 && Array.isArray(p.images) && p.images.some(u => u && u.includes('kaufland.de'))) {
            realImages = p.images.filter(u => u && u.includes('kaufland.de'));
        }

        if (realImages.length > 0) {
            console.log(`[${i+1}/${products.length}] Updating EAN ${ean} (${title.substring(0,30)}...) with ${realImages.length} Real Photos:`);
            console.log(` -> Image URL: ${realImages[0]}`);
            
            // 1. Update Supabase
            await supabase.from('products').update({ images: realImages }).eq('id', p.id);

            // 2. Update Kaufland Product Data
            try {
                await updateKauflandProductData(ean, title, p.description, realImages, p.brand);
                console.log(` -> SUCCESS: Kaufland Product Data Updated for ${ean}!`);
                updatedCount++;
            } catch (kErr) {
                console.warn(` -> Kaufland Error for ${ean}:`, kErr.response?.data || kErr.message);
            }
        } else {
            console.log(`[${i+1}/${products.length}] No real photo found for EAN ${ean} (${title.substring(0,30)}...)`);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n==============================================');
    console.log(`SUCCESSFULLY UPDATED ${updatedCount} KAUFLAND PRODUCTS WITH REAL ORIGINAL PHOTOS!`);
    console.log('==============================================');
}

run().catch(console.error);
