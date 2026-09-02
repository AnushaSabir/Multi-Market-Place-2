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

async function run() {
    console.log('--- FETCHING ALL PRODUCTS FROM SUPABASE ---');
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) { console.error('Fetch error:', error); return; }

    console.log(`Loaded ${products.length} products from database.`);
    let realPhotosFound = 0;
    let kauflandUpdated = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const title = p.title || '';
        const sku = p.sku || '';
        const ean = p.ean || '';

        // Extract ASIN from title, sku, or description
        const asinMatch = (title + ' ' + sku + ' ' + (p.description || '')).match(/\b(B0[A-Z0-9]{8})\b/i);
        const asin = asinMatch ? asinMatch[1].toUpperCase() : null;

        let realImages = [];
        if (asin) {
            realImages = await fetchRealAmazonImages(asin);
            await new Promise(r => setTimeout(r, 250)); // rate-limit friendly
        }

        if (realImages.length > 0) {
            console.log(`[${i+1}/${products.length}] Real ASIN ${asin} Photos for [${title.substring(0,35)}...]: ${realImages.length} images`);
            
            // 1. Update Supabase
            await supabase.from('products').update({ images: realImages }).eq('id', p.id);
            realPhotosFound++;

            // 2. If valid EAN, push directly to Kaufland Product Data API to replace stock photos
            if (ean && ean.length >= 8) {
                try {
                    await updateKauflandProductData(ean, title, p.description, realImages, p.brand);
                    console.log(` -> Kaufland Updated EAN ${ean} with Real Product Photo!`);
                    kauflandUpdated++;
                } catch (kErr) {
                    console.warn(` -> Kaufland update failed for EAN ${ean}:`, kErr.response?.data || kErr.message);
                }
            }
        }
    }

    console.log('\n==============================================');
    console.log(`TOTAL PRODUCTS UPDATED WITH REAL AUTHENTIC PHOTOS: ${realPhotosFound}`);
    console.log(`TOTAL KAUFLAND LISTINGS REFRESHED: ${kauflandUpdated}`);
    console.log('==============================================');
}

run().catch(console.error);
