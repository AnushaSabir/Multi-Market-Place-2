import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { classifyOrderShipping } from '../services/shippingClassifier';

dotenv.config();

type ProductRow = {
    name: string;
    quantity: number;
    bucket: 'dhl' | 'small_package' | 'unknown';
    orders: string[];
    sources: string[];
};

const BILLBEE_BASE_URLS = [
    process.env.BILLBEE_BASE_URL || 'https://api.billbee.io/api/v1',
    'https://app.billbee.io/api/v1'
];

function requiredEnv(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function normalizeName(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function addRow(rows: Map<string, ProductRow>, bucket: ProductRow['bucket'], name: string, quantity: number, orderNumber: string) {
    const cleanName = name?.trim() || 'Unknown Item';
    const key = `${bucket}:${normalizeName(cleanName)}`;
    const existing = rows.get(key);

    if (existing) {
        existing.quantity += quantity;
        existing.orders.push(orderNumber);
        return;
    }

    rows.set(key, {
        name: cleanName,
        quantity,
        bucket,
        orders: [orderNumber],
        sources: []
    });
}

function addSource(rows: Map<string, ProductRow>, bucket: ProductRow['bucket'], name: string, source?: string) {
    const key = `${bucket}:${normalizeName(name?.trim() || 'Unknown Item')}`;
    const row = rows.get(key);
    if (row && source && !row.sources.includes(source)) {
        row.sources.push(source);
    }
}

function getBillbeeOrderNumber(order: any) {
    return String(order.OrderNumber || order.Id || order.ExternalId || order.ExternalOrderNumber || 'UNKNOWN');
}

function getBillbeeSource(order: any) {
    const shop = order.ShopName || order.Seller || order.Shop || order.ShopInfo;
    if (typeof shop === 'string') return shop;
    if (shop?.BillbeeShopName || shop?.Platform) {
        return [shop.Platform, shop.BillbeeShopName].filter(Boolean).join(' / ');
    }

    return String(
        order.ShopId
        || order.Marketplace
        || order.Platform
        || order.AccountName
        || 'unknown'
    );
}

function getBillbeeItems(order: any) {
    return order.OrderItems || order.Items || order.Positions || order.OrderPositions || [];
}

function getBillbeeItemName(item: any) {
    return item.Product?.SKU
        || item.Product?.Sku
        || item.Product?.Title
        || item.ArticleNumber
        || item.SKU
        || item.Sku
        || item.Title
        || item.Name
        || item.ProductName
        || item.InvoiceText
        || 'Unknown Item';
}

function getBillbeeQuantity(item: any) {
    return Number(item.Quantity || item.Amount || item.Qty || 1);
}

function classifyBillbeeBucket(order: any, itemName?: string): ProductRow['bucket'] {
    const text = [
        order.ShippingProviderName,
        order.ShippingProviderProductName,
        order.ShippingProductName,
        order.ShippingProfileName,
        order.ShippingProviderId,
        order.ShippingProviderProductId,
        order.Shipment?.ShippingProviderName,
        order.Shipment?.ShippingProviderProductName
    ].filter(Boolean).join(' ').toLowerCase();

    if (/small|klein|warenpost|brief|31621/.test(text)) return 'small_package';
    if (/dhl|paket|parcel|31622/.test(text)) return 'dhl';

    if (itemName) {
        return classifyOrderShipping([{ title: itemName, sku: itemName }]).shipping_bucket as ProductRow['bucket'];
    }

    return 'unknown';
}

async function fetchBillbeeOrders() {
    const username = requiredEnv('BILLBEE_USERNAME');
    const password = requiredEnv('BILLBEE_PASS');
    const apiKey = requiredEnv('BILLBEE_API_KEY');
    const days = Number(process.env.BILLBEE_COMPARE_DAYS || 14);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - days);

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const orders: any[] = [];
    let page = 1;
    let activeBaseUrl = BILLBEE_BASE_URLS[0];

    while (page <= 10) {
        let response;
        try {
            response = await axios.get(`${activeBaseUrl}/orders`, {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'X-Billbee-Api-Key': apiKey,
                    Accept: 'application/json'
                },
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
                console.warn(`Billbee host unavailable (${activeBaseUrl}); retrying ${fallbackBaseUrl}`);
                activeBaseUrl = fallbackBaseUrl;
                response = await axios.get(`${activeBaseUrl}/orders`, {
            headers: {
                Authorization: `Basic ${auth}`,
                'X-Billbee-Api-Key': apiKey,
                Accept: 'application/json'
            },
            params: {
                page,
                pageSize: 250,
                minOrderDate: minDate.toISOString(),
                includePositions: true,
                orderStateId: 3
            }
                });
            } else {
                throw error;
            }
        }

        const pageOrders = response.data?.Data || response.data?.data || [];
        orders.push(...pageOrders);

        if (pageOrders.length < 250) break;
        page++;

        await new Promise(resolve => setTimeout(resolve, 600));
    }

    return orders;
}

async function fetchMarketplacePicklist() {
    const apiUrl = process.env.MARKETPLACE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const apiKey = process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_INTERNAL_API_KEY || 'Epic_Tech_2026';

    const response = await axios.get(`${apiUrl.replace(/\/$/, '')}/api/picklist`, {
        headers: { 'x-api-key': apiKey }
    });

    return response.data?.data || [];
}

function aggregateBillbee(orders: any[]) {
    const rows = new Map<string, ProductRow>();

    for (const order of orders) {
        const orderNumber = getBillbeeOrderNumber(order);
        const source = getBillbeeSource(order);
        for (const item of getBillbeeItems(order)) {
            const name = getBillbeeItemName(item);
            const bucket = classifyBillbeeBucket(order, name);
            addRow(rows, bucket, name, getBillbeeQuantity(item), orderNumber);
            addSource(rows, bucket, name, source);
        }
    }

    return rows;
}

function aggregateMarketplace(orders: any[]) {
    const rows = new Map<string, ProductRow>();

    for (const order of orders) {
        const orderNumber = String(order.order_number || order.id || 'UNKNOWN');
        const source = String(order.marketplace || 'unknown');
        const bucket = order.shipping_bucket || (String(order.dhl_versandart || '').toLowerCase().includes('small') ? 'small_package' : 'dhl');

        for (const item of order.items || []) {
            const name = item.display_name || item.sku || item.title;
            addRow(rows, bucket, name, Number(item.quantity || 1), orderNumber);
            addSource(rows, bucket, name, source);
        }
    }

    return rows;
}

function summarize(label: string, rows: Map<string, ProductRow>) {
    const values = [...rows.values()];
    const dhl = values.filter(row => row.bucket === 'dhl');
    const small = values.filter(row => row.bucket === 'small_package');
    const unknown = values.filter(row => row.bucket === 'unknown');

    console.log(`\n${label}`);
    console.log(`DHL rows: ${dhl.length}, Small Package rows: ${small.length}, Unknown rows: ${unknown.length}`);
}

function compareRows(billbee: Map<string, ProductRow>, marketplace: Map<string, ProductRow>) {
    const missingInMarketplace = [...billbee.entries()]
        .filter(([key]) => !marketplace.has(key))
        .map(([, row]) => row);

    const extraInMarketplace = [...marketplace.entries()]
        .filter(([key]) => !billbee.has(key))
        .map(([, row]) => row);

    const quantityMismatch = [...billbee.entries()]
        .filter(([key, billbeeRow]) => marketplace.has(key) && marketplace.get(key)!.quantity !== billbeeRow.quantity)
        .map(([key, billbeeRow]) => ({
            billbee: billbeeRow,
            marketplace: marketplace.get(key)!
        }));

    const report = {
        generatedAt: new Date().toISOString(),
        billbee: [...billbee.values()],
        marketplace: [...marketplace.values()],
        missingInMarketplace,
        extraInMarketplace,
        quantityMismatch
    };

    console.log('\nMissing in Marketplace:');
    console.table(missingInMarketplace.slice(0, 50).map(row => ({
        bucket: row.bucket,
        product: row.name,
        quantity: row.quantity,
        orders: [...new Set(row.orders)].slice(0, 5).join(', '),
        sources: row.sources.join(', ')
    })));

    console.log('\nExtra in Marketplace:');
    console.table(extraInMarketplace.slice(0, 50).map(row => ({
        bucket: row.bucket,
        product: row.name,
        quantity: row.quantity,
        orders: [...new Set(row.orders)].slice(0, 5).join(', '),
        sources: row.sources.join(', ')
    })));

    console.log('\nQuantity mismatch:');
    console.table(quantityMismatch.slice(0, 50).map(({ billbee, marketplace }) => ({
        bucket: billbee.bucket,
        product: billbee.name,
        billbeeQty: billbee.quantity,
        marketplaceQty: marketplace.quantity,
        billbeeSources: billbee.sources.join(', '),
        marketplaceSources: marketplace.sources.join(', ')
    })));

    const reportsDir = path.resolve(process.cwd(), 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'billbee-picklist-compare.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nFull report written to: ${reportPath}`);
}

async function main() {
    const [billbeeOrders, marketplaceOrders] = await Promise.all([
        fetchBillbeeOrders(),
        fetchMarketplacePicklist()
    ]);

    const billbeeRows = aggregateBillbee(billbeeOrders);
    const marketplaceRows = aggregateMarketplace(marketplaceOrders);

    summarize('Billbee', billbeeRows);
    summarize('Marketplace', marketplaceRows);
    compareRows(billbeeRows, marketplaceRows);
}

main().catch(error => {
    console.error(error.response?.data || error.message);
    process.exit(1);
});
