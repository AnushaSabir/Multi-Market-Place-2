"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  MoreHorizontal,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  Check,
  X,
  Eye,
  Sparkles,
  Zap,
  ImageIcon,
  Pencil,
  Store
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
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
  marketplace_products?: {
    marketplace: string
    external_id: string
    sync_status?: string
  }[]
  images?: string[]
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

  // Filter & Sort State
  const [showOptimizedOnly, setShowOptimizedOnly] = useState(false)
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortConfig, setSortConfig] = useState<{ key: 'title' | 'price' | 'quantity', direction: 'asc' | 'desc' } | null>(null)

  // Client-side Pagination State (to prevent browser lag)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Server-side Load More State
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(initialProducts.length) // Updated via API
  const [isInitialized, setIsInitialized] = useState(false)

  // Publish State
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [selectedProductForPublish, setSelectedProductForPublish] = useState<string | null>(null)
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>("")
  const [isPublishing, setIsPublishing] = useState(false)

  const fetchProducts = async () => {
    setIsLoadingMore(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })
      
      if (searchQuery) queryParams.append('search', searchQuery)
      if (marketplaceFilter && marketplaceFilter !== 'all') queryParams.append('marketplace', marketplaceFilter)
      if (statusFilter && statusFilter !== 'all') queryParams.append('status', statusFilter)
      if (sortConfig) {
        queryParams.append('sortKey', sortConfig.key)
        queryParams.append('sortDirection', sortConfig.direction)
      }

      const res = await fetch(`${API_URL}/api/products?${queryParams.toString()}`, {
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      })

      if (!res.ok) throw new Error(`API Error: ${res.status}`)

      const json = await res.json()
      setProducts(json.data || [])
      setTotalCount(json.count || 0)
    } catch (error: any) {
      console.error("Fetch Products Error:", error);
      toast({ title: "Fetch Failed", description: "Check console for details.", variant: "destructive" })
    } finally {
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true)
      return
    }
    const delayDebounceFn = setTimeout(() => {
      fetchProducts()
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, marketplaceFilter, statusFilter, sortConfig, currentPage])

  const handleSort = (key: 'title' | 'price' | 'quantity') => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
    setCurrentPage(1) // Reset to page 1 on sort
  }

  // We are using server-side pagination, so filteredProducts is just products
  const paginatedProducts = products;
  const totalPages = Math.ceil(totalCount / itemsPerPage)

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

  const savePriceEdit = async (id: string) => {
    const newPrice = Number.parseFloat(tempPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast({ title: "Invalid price", description: "Please enter a valid price.", variant: "destructive" })
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({ price: newPrice })
      })

      if (!res.ok) throw new Error("Failed to update price")

      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p)))
      setEditingPrice(null)
      toast({ title: "Price Updated", description: "Synced to all connected marketplaces." })
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message || "Could not save price", variant: "destructive" })
    }
  }

  const saveQtyEdit = async (id: string) => {
    const newQty = Number.parseInt(tempQty)
    if (isNaN(newQty) || newQty < 0) {
      toast({ title: "Invalid quantity", description: "Please enter a valid quantity.", variant: "destructive" })
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({ quantity: newQty })
      })

      if (!res.ok) throw new Error("Failed to update stock")

      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p)))
      setEditingQty(null)
      toast({ title: "Stock Updated", description: "Synced to all connected marketplaces." })
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message || "Could not save stock", variant: "destructive" })
    }
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
      toast({ title: "No products selected", description: "Please select at least one product to optimize.", variant: "destructive" })
      return
    }
    toast({ title: "AI Optimization started", description: `Optimizing ${selected.length} products for German market...` })

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    let successCount = 0;

    for (const id of selected) {
      try {
        const res = await fetch(`${API_URL}/api/ai/optimize/${id}`, {
          method: 'POST',
          headers: { 'x-api-key': 'Epic_Tech_2026' }
        });
        if (res.ok) successCount++;
      } catch (e) { console.error(e); }
    }

    toast({ title: "Optimization Complete", description: `${successCount} / ${selected.length} products optimized successfully.` })
    setSelected([])
  }

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.length} products? This cannot be undone.`)) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_URL}/api/products/batch`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({ ids: selected })
      });

      if (!res.ok) throw new Error("Batch delete failed");

      setProducts(prev => prev.filter(p => !selected.includes(p.id)));
      toast({ title: "Deleted", description: `${selected.length} products removed.` });
      setSelected([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not delete products", variant: "destructive" });
    }
  }

  const handleOptimize = async (id: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
      toast({ title: "Optimizing...", description: "AI is rewriting product content..." })
      const res = await fetch(`${API_URL}/api/ai/optimize/${id}`, {
        method: "POST", headers: { 'x-api-key': 'Epic_Tech_2026' }
      })
      if (!res.ok) throw new Error("Optimization failed")
      const result = await res.json()
      setProducts(products.map(p => p.id === id ? { ...p, ...result.data, status: 'optimized' } : p))
      toast({ title: "Success", description: "Product optimized by AI!", className: "bg-green-600 text-white" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Optimization failed", variant: "destructive" })
    }
  }

  const openPublishDialog = (id: string | null = null) => {
    setSelectedProductForPublish(id)
    setPublishDialogOpen(true)
  }

  const handlePushAllOtto = async () => {
    // 1. Find products that are from Otto
    const ottoProducts = products.filter(p =>
      p.marketplace_products?.some(mp => mp.marketplace === 'otto')
    )

    // Filter those that still need to be pushed to either Shopify or Kaufland
    const productsToPush = ottoProducts.filter(p => 
      !p.marketplace_products?.some(mp => mp.marketplace === 'shopify') || 
      !p.marketplace_products?.some(mp => mp.marketplace === 'kaufland')
    )

    if (productsToPush.length === 0) {
      toast({ title: "No new products", description: "All Otto products are already listed on Shopify and Kaufland." })
      return
    }

    if (!confirm(`Found ${productsToPush.length} Otto products missing on Shopify or Kaufland. Push them now?`)) return

    setIsPublishing(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
    const targetMarketplaces = ['shopify', 'kaufland']
    let totalSuccess = 0
    let totalFail = 0

    try {
      for (const product of productsToPush) {
        for (const mp of targetMarketplaces) {
          // Skip if already on this marketplace
          if (product.marketplace_products?.some(pmp => pmp.marketplace === mp)) {
            continue;
          }

          try {
            const res = await fetch(`${API_URL}/api/products/${product.id}/publish`, {
              method: "POST",
              headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
              body: JSON.stringify({ marketplace: mp })
            })
            if (res.ok) totalSuccess++
            else totalFail++
          } catch (e) { totalFail++ }
        }
      }
      toast({
        title: "Bulk Push Complete",
        description: `Total Success: ${totalSuccess}, Failures: ${totalFail}`,
        className: "bg-blue-600 text-white"
      })
    } catch (error) {
      toast({ title: "Error", description: "Bulk push failed", variant: "destructive" })
    } finally {
      setIsPublishing(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedMarketplace) return
    const idsToPublish = selectedProductForPublish ? [selectedProductForPublish] : selected
    if (idsToPublish.length === 0) return

    setIsPublishing(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
    let successCount = 0
    let failCount = 0

    try {
      const targetMarketplaces = selectedMarketplace === 'all' ? ['ebay', 'shopify', 'kaufland'] : [selectedMarketplace]

      for (const id of idsToPublish) {
        for (const mp of targetMarketplaces) {
          try {
            const res = await fetch(`${API_URL}/api/products/${id}/publish`, {
              method: "POST",
              headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
              body: JSON.stringify({ marketplace: mp })
            })
            if (!res.ok) throw new Error("Failed");
            successCount++
          } catch (e) { failCount++ }
        }
      }
      toast({
        title: "Publish Complete",
        description: `Success: ${successCount}, Failed: ${failCount}`,
        className: successCount > 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"
      })
      setPublishDialogOpen(false)
      setSelected([])
    } catch (error: any) {
      toast({ title: "Error", description: "Batch publish encountered an error", variant: "destructive" })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL products locally. Are you sure?")) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_URL}/api/products/cleanup?marketplace=all`, {
        method: 'DELETE', headers: { 'x-api-key': 'Epic_Tech_2026' }
      });
      if (!res.ok) throw new Error("Delete All failed");
      setProducts([]); setSelected([]);
      toast({ title: "System Cleared", description: "All products have been deleted." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Could not clear system", variant: "destructive" });
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE', headers: { 'x-api-key': 'Epic_Tech_2026' }
      });
      if (!res.ok) throw new Error("Delete failed");
      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Deleted", description: "Product removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Could not delete product", variant: "destructive" });
    }
  }

  const handleBulkSync = async () => {
    if (selected.length === 0) {
      toast({ title: "No products", description: "Select products to sync.", variant: "destructive" })
      return
    }
    toast({ title: "Sync started", description: `Syncing ${selected.length} products...` })
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_URL}/api/sync/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({ ids: selected })
      });
      if (!res.ok) throw new Error("Sync failed");
      toast({ title: "Sync complete", description: "Products pushed to marketplaces." })
      setSelected([])
    } catch (e) {
      toast({ title: "Sync Error", description: "Failed to sync products.", variant: "destructive" });
    }
  }

  // Helper to check marketplace status
  const getMarketplaceStatus = (product: Product, mp: string) => {
    const found = product.marketplace_products?.find(p => p.marketplace === mp);
    return found ? { connected: true, data: found } : { connected: false };
  }

  const searchParams = useSearchParams()
  const router = useRouter()
  const marketplaceParam = searchParams.get('marketplace')

  return (
    <div className="p-6 space-y-6 animate-fade-in w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            {marketplaceParam ? `${marketplaceParam.charAt(0).toUpperCase() + marketplaceParam.slice(1)} Products` : 'Products'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Total {totalCount} products found
            {marketplaceParam && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-2 text-blue-600"
                onClick={() => router.push('/products')}
              >
                Clear filter
              </Button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handlePushAllOtto} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg transition-all animate-pulse-subtle border-0">
            <Zap className="mr-2 h-4 w-4" /> Push New Otto
          </Button>
          <Button size="sm" onClick={() => openPublishDialog(null)} className="bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all">
            <Store className="mr-2 h-4 w-4" /> Bulk Publish
          </Button>
          <Button size="sm" onClick={handleBulkSync} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Sync All
          </Button>
          <Button size="sm" onClick={handleBulkAIOptimization} variant="ghost">
            <Sparkles className="mr-2 h-4 w-4" /> Bulk AI
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
            <Trash2 className="mr-2 h-4 w-4" /> Reset All
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-border/50 shadow-sm">
        <div className="p-5 border-b bg-white/40 dark:bg-slate-800/40 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 bg-white dark:bg-slate-900 border-border/50 shadow-sm focus-visible:ring-primary/50" placeholder="Search products, SKU or EAN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-slate-900 border-border/50">
                <SelectValue placeholder="All Markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="otto">Otto</SelectItem>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="kaufland">Kaufland</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-slate-900 border-border/50">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft (Approval Queue)</SelectItem>
                <SelectItem value="imported">Imported</SelectItem>
                <SelectItem value="optimized">Optimized</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {selected.length > 0 && (
              <>
                <span className="text-sm font-medium px-2">{selected.length} Selected</span>
                <Button size="sm" onClick={() => openPublishDialog(null)}>Publish</Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete}><Trash2 className="w-4 h-4" /></Button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-transparent border-b-border/50">
                <TableHead className="w-10 text-center font-semibold">
                  <Checkbox checked={selected.length > 0 && selected.length === products.length} onCheckedChange={(c) => setSelected(c ? products.map(p => p.id) : [])} />
                </TableHead>
                <TableHead className="w-16 font-semibold">Image</TableHead>
                <TableHead className="w-24 font-semibold">SKU / EAN</TableHead>
                <TableHead className="font-semibold cursor-pointer hover:bg-muted/50" onClick={() => handleSort('title')}>
                  Product Title {sortConfig?.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-24 font-semibold cursor-pointer hover:bg-muted/50" onClick={() => handleSort('price')}>
                  Price {sortConfig?.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-20 font-semibold cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity')}>
                  Stock {sortConfig?.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-40 text-center font-semibold">Platform Actions</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-muted/50 group text-sm">
                  <TableCell className="text-center py-2">
                    <Checkbox checked={selected.includes(product.id)} onCheckedChange={() => toggleSelect(product.id)} />
                  </TableCell>

                  <TableCell className="py-2">
                    <div className="h-10 w-10 bg-muted rounded flex items-center justify-center border overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableCell>

                  <TableCell className="py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs font-semibold">{product.sku || <span className="text-red-300">No SKU</span>}</span>
                      <span className="text-[10px] text-muted-foreground">{product.ean || "-"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-2 align-top">
                    <div className="font-medium line-clamp-2" title={product.title}>{product.title}</div>
                    {product.status === 'optimized' && (
                      <Badge variant="secondary" className="mt-1 text-[10px] h-5 bg-purple-100 text-purple-700">Optimized</Badge>
                    )}
                  </TableCell>

                  <TableCell className="py-2 align-top font-semibold">
                    {editingPrice === product.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-20 h-8"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && savePriceEdit(product.id)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => savePriceEdit(product.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/edit cursor-pointer" onClick={() => handlePriceEdit(product.id, product.price)}>
                        <span>{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(product.price)}</span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover/edit:opacity-100 text-blue-500" />
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="py-2 align-top">
                    {editingQty === product.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-16 h-8"
                          value={tempQty}
                          type="number"
                          onChange={(e) => setTempQty(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveQtyEdit(product.id)}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => saveQtyEdit(product.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/edit cursor-pointer" onClick={() => handleQtyEdit(product.id, product.quantity)}>
                        <span className={`px-2 py-0.5 rounded text-xs ${product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.quantity}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover/edit:opacity-100 text-blue-500" />
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="py-2 align-top text-center">
                    <div className="flex justify-center gap-2">
                      {['ebay', 'shopify', 'otto', 'kaufland'].map((mp) => {
                        const { connected } = getMarketplaceStatus(product, mp);
                        return (
                          <div key={mp} className="relative group/icon">
                            <button
                              onClick={() => connected ? null : openPublishDialog(product.id)}
                              className={`
                                            h-8 w-8 rounded-md flex items-center justify-center border transition-all duration-200 text-xs font-bold uppercase
                                            ${connected
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm hover:bg-emerald-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white hover:border-primary/40 hover:text-primary hover:shadow-sm'}
                                        `}
                              title={connected ? `Synced to ${mp}` : `Click to Publish to ${mp}`}
                            >
                              {mp.charAt(0)}
                              {!connected && <Plus className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-primary text-white rounded-full p-0.5 shadow-sm" />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </TableCell>

                  <TableCell className="text-right py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/products/${product.id}`}>Details</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOptimize(product.id)}>AI Optimize</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-red-600">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center justify-between p-5 bg-white/40 dark:bg-slate-800/40 border-t border-border/50 backdrop-blur-md rounded-b-xl">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} products
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm font-medium px-4">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish to Marketplace</DialogTitle></DialogHeader>
          <Select onValueChange={setSelectedMarketplace} value={selectedMarketplace}>
            <SelectTrigger><SelectValue placeholder="Select Marketplace" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Marketplaces (eBay, Shopify, Kaufland)</SelectItem>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="otto">Otto</SelectItem>
              <SelectItem value="kaufland">Kaufland</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={handlePublish} disabled={isPublishing}>Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
