import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';

export class OttoImporter extends BaseImporter {
    marketplace: 'otto' = 'otto';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        console.log("Fetching all products from Otto API...");

        let allProducts: ImportedProduct[] = [];
        let nextUrl: string | null = 'https://api.otto.market/v5/products?limit=50';
        let pageCount = 0;
        const MAX_PAGES = 50;
        let totalProcessed = 0;

        try {
            while (nextUrl && pageCount < MAX_PAGES) {
                if (BaseImporter.stopImport) throw new Error("Import stopped by user");
                console.log(`Fetching page ${pageCount + 1}...`);

                // Add a small delay between pages to prevent overloading Otto API
                if (pageCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }

                const response: any = await axios.get(nextUrl!, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    timeout: 45000 // Increase timeout to 45 seconds for large pages
                });

                let productsRaw = [];
                if (Array.isArray(response.data)) {
                    productsRaw = response.data;
                } else if (response.data.productVariations && Array.isArray(response.data.productVariations)) {
                    productsRaw = response.data.productVariations;
                } else if (response.data.resources && Array.isArray(response.data.resources)) {
                    productsRaw = response.data.resources;
                }

                if (productsRaw.length === 0) {
                    console.log("No more products found on this page.");
                    break;
                }

                const pageProducts = productsRaw.map((p: any) => {
                    const actualSku = p.sku || p.partnerSku || p.productReference;
                    return {
                        title: p.productName || p.productReference || 'Unknown Title',
                        description: p.productDescription?.description || p.description || '',
                        sku: actualSku,
                        ean: p.ean || p.gtin || '',
                        price: parseFloat(p.pricing?.standardPrice?.amount || p.price || '0'),
                        quantity: parseInt(p.stock?.quantity || p.quantity || '0'),
                        images: p.mediaAssets?.map((m: any) => m.location) || [],
                        external_id: actualSku, // Ensure external_id is the SKU, not the title
                        marketplace: 'otto'
                    };
                });

                for (const prod of pageProducts) {
                    await this.upsertProduct(prod as ImportedProduct);
                    totalProcessed++;
                }

                console.log(`Page ${pageCount + 1} processed. Total items: ${totalProcessed}`);

                const links: any = response.data.links || response.data._links;
                const nextLink: any = Array.isArray(links) ? links.find((l: any) => l.rel === 'next') : (links?.next || null);

                if (nextLink && nextLink.href) {
                    let href = nextLink.href;
                    if (!href.startsWith('http')) {
                        const baseUrl = 'https://api.otto.market';
                        href = href.startsWith('/') ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
                    }
                    nextUrl = href;
                } else {
                    nextUrl = null;
                }

                pageCount++;
            }
        } catch (error: any) {
            console.error("Otto Fetch Error:", error.response?.data || error.message);
            if (totalProcessed > 0) return totalProcessed;
            throw error;
        }

        console.log(`Total Otto products imported: ${totalProcessed}`);
        return totalProcessed;
    }
}
