// and fetching data directly from Supabase to pass to the client component.
import { createClient } from "@/lib/supabase/server"
import { ProductList } from "@/components/product-list"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 49)

  if (error) {
    console.error("[v0] Error fetching products:", error)
  }

  return (
    <div className="p-6">
      <Suspense fallback={<div className="p-6 text-center">Lade Produkte...</div>}>
        <ProductList initialProducts={products || []} />
      </Suspense>
    </div>
  )
}
