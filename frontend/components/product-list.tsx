"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, MoreHorizontal, Sparkles, RefreshCw, Eye, Check, X, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  title: string
  sku: string
  ean: string
  price: number
  quantity: number
  status: string
  shipping_type?: string
}

export function ProductList({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [selected, setSelected] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState<string | null>(null)
  const [tempPrice, setTempPrice] = useState<string>("")
  const [tempQty, setTempQty] = useState<string>("")
  const { toast } = useToast()

  // Pagination State
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const loadMoreProducts = async () => {
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API_URL}/api/products?page=${nextPage}&limit=50`)

      if (!res.ok) throw new Error("Failed to load more products")

      const data = await res.json()

      if (data.data.length === 0) {
        setHasMore(false)
        toast({ title: "No more products", description: "You have reached the end of the list." })
      } else {
        setProducts(prev => [...prev, ...data.data])
        setPage(nextPage)
      }
    } catch (error: any) {
      console.error("Load More Error:", error);
      toast({ title: "Error", description: error.message || "Could not load more products", variant: "destructive" })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handlePriceEdit = (id: string, currentPrice: number) => {
    setEditingPrice(id)
    setTempPrice(currentPrice.toString())
  }

  const handleQtyEdit = (id: string, currentQty: number) => {
    setEditingQty(id)
    setTempQty(currentQty.toString())
  }

  const savePriceEdit = (id: string) => {
    const newPrice = Number.parseFloat(tempPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price.",
        variant: "destructive",
      })
      return
    }

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p)))
    setEditingPrice(null)
    toast({
      title: "Price updated",
      description: "Product price has been updated successfully.",
    })
  }

  const saveQtyEdit = (id: string) => {
    const newQty = Number.parseInt(tempQty)
    if (isNaN(newQty) || newQty < 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity.",
        variant: "destructive",
      })
      return
    }

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p)))
    setEditingQty(null)
    toast({
      title: "Quantity updated",
      description: "Product quantity has been updated successfully.",
    })
  }

  const cancelPriceEdit = () => {
    setEditingPrice(null)
    setTempPrice("")
  }

  const cancelQtyEdit = () => {
    setEditingQty(null)
    setTempQty("")
  }

  const handleBulkAIOptimization = async () => {
    if (selected.length === 0) {
      toast({
        title: "No products selected",
        description: "Please select at least one product to optimize.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "AI Optimization started",
      description: `Optimizing ${selected.length} products for German market...`,
    })

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    let successCount = 0;

    for (const id of selected) {
      try {
        // Step 1: Optimize locally via API
        toast({ title: "AI Optimization Started", description: "Generating optimizations..." });

        const res = await fetch(`${API_URL}/api/ai/optimize/${id}`, {
          method: 'POST',
          headers: { 'x-api-key': 'Epic_Tech_2026' }
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    toast({
      title: "Optimization Complete",
      description: `${successCount} / ${selected.length} products optimized successfully. Refresh to see changes.`,
    })

    // Ideally we re-fetch products here, but for now user can refresh.
    setSelected([])
  }

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.length} products? This cannot be undone.`)) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/products/batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Epic_Tech_2026'
        },
        body: JSON.stringify({ ids: selected })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Batch delete failed");
      }

      setProducts(prev => prev.filter(p => !selected.includes(p.id)));
      toast({ title: "Deleted", description: `${selected.length} products removed.` });
      setSelected([]);

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Could not delete products", variant: "destructive" });
    }
  }

  const handleDeleteAll = async () => {
    // Double confirmation for safety
    if (!confirm("⚠️ WARNING: This will delete ALL products locally. Are you sure?")) return;
    if (!confirm("This action is irreversible. All synced data will be lost. Proceed?")) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/products/cleanup?marketplace=all`, {
        method: 'DELETE',
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Delete All failed");
      }

      setProducts([]);
      setSelected([]);
      toast({ title: "System Cleared", description: "All products have been deleted." });

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Could not clear system", variant: "destructive" });
    }
  }

  const handleBulkSync = async () => {
    if (selected.length === 0) {
      toast({
        title: "No products selected",
        description: "Please select at least one product to sync.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Sync started",
      description: `Syncing ${selected.length} product(s) to all connected marketplaces...`,
    })

    toast({
      title: "Sync started",
      description: `Syncing ${selected.length} product(s) to all connected marketplaces...`,
    })

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Epic_Tech_2026'
        },
        body: JSON.stringify({ ids: selected })
      });

      if (!res.ok) throw new Error("Sync failed");

      toast({
        title: "Sync complete",
        description: `${selected.length} product(s) successfully pushed to all marketplaces.`,
      })
      setSelected([])

    } catch (e) {
      toast({
        title: "Sync Error",
        description: "Failed to sync products. Check connection.",
        variant: "destructive"
      });
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Delete failed");
      }

      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Deleted", description: "Product removed." });

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Could not delete product", variant: "destructive" });
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBulkSync}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync All
          </Button>
          <Button size="sm" onClick={handleBulkAIOptimization}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Optimization (Bulk)
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/10 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            {selected.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{selected.length} selected</span>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
                <Button size="sm" variant="secondary" onClick={handleBulkAIOptimization}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Optimize Selected
                </Button>
                <Button size="sm" onClick={handleBulkSync}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Selected
                </Button>
              </div>
            )}
            <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.length > 0 && selected.length === filteredProducts.length}
                    onCheckedChange={(checked) => setSelected(checked ? filteredProducts.map((p) => p.id) : [])}
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead className="hidden md:table-cell">SKU / EAN</TableHead>
                <TableHead>Price / Qty</TableHead>
                <TableHead className="hidden lg:table-cell">Marketplaces</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox checked={selected.includes(product.id)} onCheckedChange={() => toggleSelect(product.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium truncate max-w-[200px]" title={product.title}>{product.title}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm font-mono">{product.sku}</div>
                    <div className="text-xs text-muted-foreground">{product.ean}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {editingPrice === product.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(e.target.value)}
                            className="h-7 w-20 text-sm"
                            step="0.01"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => savePriceEdit(product.id)}
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelPriceEdit}>
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="font-medium cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handlePriceEdit(product.id, product.price)}
                        >
                          {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(product.price)}
                        </div>
                      )}
                      {editingQty === product.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={tempQty}
                            onChange={(e) => setTempQty(e.target.value)}
                            className="h-7 w-16 text-sm"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveQtyEdit(product.id)}>
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelQtyEdit}>
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`text-xs cursor-pointer hover:text-primary transition-colors ${product.quantity < 10 ? "text-red-600 font-bold" : "text-muted-foreground"}`}
                          onClick={() => handleQtyEdit(product.id, product.quantity)}
                        >
                          Stock: {product.quantity}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1">
                      {product.shipping_type && (
                        <Badge variant="secondary" className="capitalize text-[10px] px-1.5 h-5">
                          {product.shipping_type}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === "synced" ? "outline" : "secondary"}>
                      {product.status || "Imported"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.id}`} className="flex items-center" prefetch={true}>
                            <Eye className="mr-2 h-4 w-4" /> Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No products found in database.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {
        hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={loadMoreProducts}
              disabled={isLoadingMore}
              variant="outline"
              className="w-full max-w-xs"
            >
              {isLoadingMore ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading...
                </>
              ) : (
                "Load More Products"
              )}
            </Button>
          </div>
        )
      }
    </div >
  )
}
