// and fetching data directly from Supabase to pass to the client component.
import { createClient } from "@/lib/supabase/server"
import { ProductList } from "@/components/product-list"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const supabase = await createClient()

  let products: any[] = []
  let error: any = null

  try {
    const response = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, 9999)

    products = response.data || []
    error = response.error
  } catch (err: any) {
    console.error("[v0] CRITICAL: Server-side fetch failed (Network/Timeout). Rendering with empty list.", err.message)
    // We suppress the crash so the page can at least load the client component
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
