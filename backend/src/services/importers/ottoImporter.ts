import { BaseImporter, ImportedProduct } from './baseImporter';
import axios from 'axios';

export class OttoImporter extends BaseImporter {
    marketplace: 'otto' = 'otto';

    protected async fetchProductsFromApi(accessToken: string): Promise<ImportedProduct[] | number> {
        console.log("Fetching all products from Otto API...");

        let allProducts: ImportedProduct[] = [];
        let nextUrl: string | null = 'https://api.otto.market/v4/products?limit=50';
        let pageCount = 0;
        const MAX_PAGES = 50;
        let totalProcessed = 0;

        try {
            while (nextUrl && pageCount < MAX_PAGES) {
                if (BaseImporter.stopImport) throw new Error("Import stopped by user");
                console.log(`Fetching page ${pageCount + 1}...`);
                const response: any = await axios.get(nextUrl!, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
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

                const pageProducts = productsRaw.map((p: any) => ({
                    title: p.productName || p.productReference || 'Unknown Title',
                    description: p.productDescription?.description || p.description || '',
                    sku: p.sku || p.partnerSku || '',
                    ean: p.ean || p.gtin || '',
                    price: parseFloat(p.pricing?.standardPrice?.amount || p.price || '0'),
                    quantity: parseInt(p.stock?.quantity || p.quantity || '0'),
                    images: p.mediaAssets?.map((m: any) => m.location) || [],
                    external_id: p.productReference || p.sku,
                    marketplace: 'otto'
                }));

                for (const prod of pageProducts) {
                    await this.upsertProduct(prod as ImportedProduct);
                    totalProcessed++;
                }

                console.log(`Page ${pageCount + 1} processed. Total items: ${totalProcessed}`);

                const links: any = response.data.links;
                const nextLink: any = Array.isArray(links) ? links.find((l: any) => l.rel === 'next') : null;

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
