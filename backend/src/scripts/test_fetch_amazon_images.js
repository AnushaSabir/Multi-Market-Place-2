const axios = require('axios');
const cheerio = require('cheerio');

async function getAmazonImages(asin) {
    const url = 'https://www.amazon.de/dp/' + asin;
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        });

        const $ = cheerio.load(res.data);
        const dynamicImg = $('#landingImage').attr('data-a-dynamic-image');
        if (dynamicImg) {
            const parsed = JSON.parse(dynamicImg);
            const imgs = Object.keys(parsed);
            console.log('ASIN ' + asin + ' - Found ' + imgs.length + ' images:');
            console.log(' -> Main Image:', imgs[0]);
            return imgs;
        }

        const match = res.data.match(/'colorImages':\s*\{\s*'initial':\s*(\[.*?\])\s*\}/s);
        if (match) {
            const raw = JSON.parse(match[1]);
            const imgs = raw.map(i => i.hiRes || i.large).filter(Boolean);
            console.log('ASIN ' + asin + ' - colorImages found ' + imgs.length + ' images:');
            console.log(' -> Main Image:', imgs[0]);
            return imgs;
        }

        console.log('ASIN ' + asin + ' - No dynamic image found in HTML (status: ' + res.status + ')');
    } catch (e) {
        console.log('ASIN ' + asin + ' - Request failed:', e.message);
    }
}

async function run() {
    await getAmazonImages('B0DP7NSB12');
    await getAmazonImages('B0DM9BQ6XG');
    await getAmazonImages('B09FKF8LHB');
    await getAmazonImages('B08CXYXW1L');
    await getAmazonImages('B0DHVB9LJB');
}
run();
