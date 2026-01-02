import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';

export class EbayImporter extends BaseImporter {
    marketplace: 'ebay' = 'ebay';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[]> {
        // Searching for 'iphone' as a test. TODO: Change 'iphone' to your seller username filter like `q=...&filter=sellers:{USERNAME}`
        console.log(`Starting Unlimited Import from eBay (Seller: ${process.env.EBAY_SELLER_ID || 'All'})...`);

        // Use a wildcard '*' to match EVERYTHING from this seller.
        const sellerFilter = process.env.EBAY_SELLER_ID ? `&filter=sellers:{${process.env.EBAY_SELLER_ID}}` : '';
        // "q= " (space) is the standard way to match all items when filtering by seller
        let nextUrl: string | null = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=%20${sellerFilter}&limit=100`;

        let pageCount = 0;
        let totalSaved = 0;

        // ...

        try {
            while (nextUrl) {
                console.log(`Fetching eBay page ${pageCount + 1}...`);
                // Explicitly type response as any to avoid circular type inference issues
                const response: any = await axios.get(nextUrl!, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE' // Critical for German sellers!
                    }
                });

                const items = response.data.itemSummaries || [];
                if (items.length === 0) {
                    console.log("No more items found.");
                    break;
                }

                // Map and Save immediately (Batch Processing)
                if (items.length > 0) {
                    // Debug: Log the first item to see structure
                    console.log("Debug Item 1:", JSON.stringify(items[0], null, 2));
                    console.log("GTIN check:", items[0].gtin);
                }

                const pageProducts: ImportedProduct[] = items.map((item: any) => ({
                    title: item.title || 'Unknown eBay Item',
                    description: item.shortDescription || '',
                    sku: item.sku || item.legacyItemId || item.itemId, // Try item.sku first
                    ean: item.gtin || item.ean || item.upc || item.isbn || '', // Try specific fields if gtin missing
                    price: parseFloat(item.price?.value || '0'),
                    quantity: 1,
                    weight: 0,
                    images: item.image ? [item.image.imageUrl] : [],
                    external_id: item.itemId,
                    marketplace: 'ebay'
                }));

                for (const product of pageProducts) {
                    try {
                        await this.upsertProduct(product);
                        totalSaved++;
                    } catch (err: any) {
                        console.error(`Failed to save item ${product.sku}:`, err.message);
                    }
                }

                console.log(`Page ${pageCount + 1} done. Total saved so far: ${totalSaved}`);

                // Pagination
                const nextLink = response.data.next;
                nextUrl = nextLink ? nextLink : null;

                // Fix: Ensure 'q' parameter exists in nextUrl if it was dropped
                if (nextUrl && !nextUrl.includes('q=')) {
                    nextUrl += '&q=%20';
                }

                pageCount++;
            }
        } catch (error: any) {
            // If we saved at least some items, we consider it a partial success
            if (totalSaved > 0) {
                console.warn("eBay Import stopped after partial success:", error.message);
                // Exit logic handled by returning empty array later
            }
            console.error("eBay Fetch Critical Error:", error.response?.data || error.message);
            throw error;
        }

        console.log(`eBay Import Finished. Total successfully imported: ${totalSaved}`);
        // Return empty array because we already upserted everything locally
        return [];
    }
}
