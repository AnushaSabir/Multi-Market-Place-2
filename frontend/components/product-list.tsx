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
  Pencil
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

  // Pagination State
  // FIX: Start page at 1, so next request is for page 2
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false) // Default false as we load all
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Filter State
  const [showOptimizedOnly, setShowOptimizedOnly] = useState(false)

  // Publish State
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [selectedProductForPublish, setSelectedProductForPublish] = useState<string | null>(null)
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>("")
  const [isPublishing, setIsPublishing] = useState(false)

  const loadMoreProducts = async () => {
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      console.log("Loading page:", nextPage) // DEBUG

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API_URL}/api/products?page=${nextPage}&limit=50`, {
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      })

      if (!res.ok) throw new Error(`API Error: ${res.status}`)

      const json = await res.json()
      const newProducts = json.data

      if (!newProducts || newProducts.length === 0) {
        setHasMore(false)
        toast({ title: "End of list", description: "No more products to load." })
      } else {
        // Prevent duplicates
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const uniqueNew = newProducts.filter((p: Product) => !existingIds.has(p.id))
          return [...prev, ...uniqueNew]
        })
        setPage(nextPage)
      }
    } catch (error: any) {
      console.error("Load More Error:", error);
      toast({ title: "Load Failed", description: "Check console for details.", variant: "destructive" })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ean?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!showOptimizedOnly || p.status === 'optimized')
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

  const savePriceEdit = async (id: string) => {
    const newPrice = Number.parseFloat(tempPrice)
    if (isNaN(newPrice) || newPrice < 0) {
      toast({ title: "Invalid price", description: "Please enter a valid price.", variant: "destructive" })
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
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

  const handlePublish = async () => {
    if (!selectedMarketplace) return
    const idsToPublish = selectedProductForPublish ? [selectedProductForPublish] : selected
    if (idsToPublish.length === 0) return

    setIsPublishing(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    let successCount = 0
    let failCount = 0

    try {
      for (const id of idsToPublish) {
        try {
          const res = await fetch(`${API_URL}/api/products/${id}/publish`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
            body: JSON.stringify({ marketplace: selectedMarketplace })
          })
          if (!res.ok) throw new Error("Failed");
          successCount++
        } catch (e) { failCount++ }
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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

  return (
    <div className="p-6 space-y-6 animate-fade-in w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleBulkSync} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Sync All
          </Button>
          <Button size="sm" onClick={handleBulkAIOptimization}>
            <Sparkles className="mr-2 h-4 w-4" /> Bulk AI
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/10 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 text-center">
                  <Checkbox checked={selected.length > 0 && selected.length === filteredProducts.length} onCheckedChange={(c) => setSelected(c ? filteredProducts.map(p => p.id) : [])} />
                </TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead className="w-24">SKU / EAN</TableHead>
                <TableHead>Product Title</TableHead>
                <TableHead className="w-24">Price</TableHead>
                <TableHead className="w-20">Stock</TableHead>
                <TableHead className="w-40 text-center">Platform Actions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
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
                    {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(product.price)}
                  </TableCell>

                  <TableCell className="py-2 align-top">
                    <span className={`px-2 py-0.5 rounded text-xs ${product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {product.quantity}
                    </span>
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
                                            h-7 w-7 rounded-sm flex items-center justify-center border transition-all text-[10px] font-bold uppercase
                                            ${connected
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-white hover:border-blue-300 hover:text-blue-500'}
                                        `}
                              title={connected ? `Synced to ${mp}` : `Click to Publish to ${mp}`}
                            >
                              {mp.charAt(0)}
                              {!connected && <Plus className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-blue-500 text-white rounded-full p-0.5" />}
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

      {/* Pagination Removed as per user request to show all products */}

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish to Marketplace</DialogTitle></DialogHeader>
          <Select onValueChange={setSelectedMarketplace} value={selectedMarketplace}>
            <SelectTrigger><SelectValue placeholder="Select Marketplace" /></SelectTrigger>
            <SelectContent>
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
