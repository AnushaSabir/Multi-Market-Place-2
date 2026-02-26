// and fetching data directly from Supabase to pass to the client component.
import { createClient } from "@/lib/supabase/server"
import { ProductList } from "@/components/product-list"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function ProductsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ marketplace?: string }> }) {
  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const selectedMarketplace = searchParams.marketplace

  let products: any[] = []
  let error: any = null

  try {
    let query;
    if (selectedMarketplace && selectedMarketplace !== 'all') {
      query = supabase
        .from("products")
        .select(`
          *,
          marketplace_products!inner (
            marketplace,
            external_id,
            sync_status
          )
        `)
        .eq('marketplace_products.marketplace', selectedMarketplace)
    } else {
      query = supabase
        .from("products")
        .select(`
          *,
          marketplace_products (
            marketplace,
            external_id,
            sync_status
          )
        `)
    }

    const response = await query
      .order("created_at", { ascending: false })
      .range(0, 9999)

    products = response.data || []
    error = response.error
  } catch (err: any) {
    console.error("[v0] CRITICAL: Server-side fetch failed (Network/Timeout). Rendering with empty list.", err.message)
    products = []
  }

  if (error) {
    console.error("[v0] Supabase Error:", JSON.stringify(error, null, 2))
    if (error.message) console.error("Error Message:", error.message);
  }

  return (
    <div className="p-6">
      <Suspense fallback={<div className="p-6 text-center">Lade Produkte...</div>}>
        <ProductList initialProducts={products || []} />
      </Suspense>
    </div>
  )
}
