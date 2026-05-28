"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Sparkles, RefreshCw, Store, ImageIcon, Save, Check, X, History } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface MarketplaceProduct {
  id?: string
  marketplace: string
  sync_status: string
  last_synced_at: string
  external_id: string
  price?: number
  is_custom_price?: boolean
}

interface Product {
  id: string
  title: string
  sku: string
  ean: string
  price: number
  quantity: number
  weight: number
  shipping_type?: string
  description: string
  status: string
  marketplace_products?: MarketplaceProduct[]
}

interface StockMovement {
  id: string
  created_at: string
  change: number
  current_stock: number
  order_id: string | null
  platform: string
  type: string
  user_name: string
}

export default function ProductDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Editing State
  const [formData, setFormData] = useState<Partial<Product>>({})
  const [tempStock, setTempStock] = useState<number>(0)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [editingMarketplacePrice, setEditingMarketplacePrice] = useState<{ marketplace: string, price: number } | null>(null)

  useEffect(() => {
    if (!id) return;

    const fetchProductAndStock = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
        const [res, stockRes] = await Promise.all([
          fetch(`${API_URL}/api/products/${id}`, { headers: { 'x-api-key': 'Epic_Tech_2026' } }),
          fetch(`${API_URL}/api/products/${id}/stock-movements`, { headers: { 'x-api-key': 'Epic_Tech_2026' } }).catch(() => ({ ok: false, json: () => ({ data: [] }) } as any))
        ])
        
        if (!res.ok) throw new Error("Product not found")
        const json = await res.json()
        setProduct(json.data)
        setFormData(json.data)
        setTempStock(json.data.quantity || 0)

        if (stockRes.ok) {
          const stockJson = await stockRes.json()
          setStockMovements(stockJson.data || [])
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to load product details", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchProductAndStock()
  }, [id])

  const handleSave = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Epic_Tech_2026'
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown server error" }));
        throw new Error(errorData.error || "Failed to update");
      }

      toast({ title: "Saved", description: "Product updated successfully." })
      setProduct(prev => ({ ...prev!, ...formData } as Product))
    } catch (e: any) {
      toast({ title: "Error", description: `Could not save changes: ${e.message}`, variant: "destructive" })
    }
  }

  const handleUpdateStock = async () => {
    try {
      const change = tempStock - (product?.quantity || 0);
      if (change === 0) return toast({ title: "No changes", description: "Stock is the same." });

      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${API_URL}/api/products/${id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({
          change,
          current_stock: tempStock,
          platform: 'System',
          type: 'manual',
          user_name: 'Admin'
        })
      });

      if (!res.ok) throw new Error("Failed to update stock");
      
      toast({ title: "Stock Updated", description: "Movement has been logged." });
      setProduct(prev => ({ ...prev!, quantity: tempStock } as Product));
      setFormData(prev => ({ ...prev, quantity: tempStock }));
      
      // Reload stock movements
      const stockRes = await fetch(`${API_URL}/api/products/${id}/stock-movements`, { headers: { 'x-api-key': 'Epic_Tech_2026' } });
      if (stockRes.ok) {
        const stockJson = await stockRes.json();
        setStockMovements(stockJson.data || []);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleOptimise = async () => {
    toast({ title: "AI Optimization", description: "Generating new content..." })
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${API_URL}/api/ai/optimize/${id}`, {
        method: 'POST',
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      })
      if (!res.ok) throw new Error("AI Failed")
      const json = await res.json()
      setProduct(prev => ({ ...prev!, ...json.data, status: 'optimized' } as Product))
      setFormData(prev => ({ ...prev, ...json.data }))
      toast({ title: "Success", description: "Content optimized!" })
    } catch (e) {
      toast({ title: "Error", description: "AI Optimization failed", variant: "destructive" })
    }
  }

  const toggleCustomPrice = (marketplace: string, useMaster: boolean) => {
    const updatedMps = [...(formData.marketplace_products || [])];
    const mpIndex = updatedMps.findIndex(mp => mp.marketplace === marketplace);
    
    if (mpIndex > -1) {
      updatedMps[mpIndex] = { ...updatedMps[mpIndex], is_custom_price: !useMaster, price: useMaster ? null : formData.price };
    } else if (!useMaster) {
      updatedMps.push({ marketplace, sync_status: 'pending', last_synced_at: new Date().toISOString(), external_id: '', is_custom_price: true, price: formData.price });
    }
    
    setFormData({ ...formData, marketplace_products: updatedMps });
  }

  const saveCustomPrice = () => {
    if (!editingMarketplacePrice) return;
    const { marketplace, price } = editingMarketplacePrice;
    
    const updatedMps = [...(formData.marketplace_products || [])];
    const mpIndex = updatedMps.findIndex(mp => mp.marketplace === marketplace);
    
    if (mpIndex > -1) {
      updatedMps[mpIndex] = { ...updatedMps[mpIndex], is_custom_price: true, price };
    } else {
      updatedMps.push({ marketplace, sync_status: 'pending', last_synced_at: new Date().toISOString(), external_id: '', is_custom_price: true, price });
    }
    
    setFormData({ ...formData, marketplace_products: updatedMps });
    setEditingMarketplacePrice(null);
  }

  if (!product) return <div className="p-10 text-center">Product not found.</div>

  const ALL_MARKETPLACES = ['amazon', 'ebay', 'otto', 'shopify', 'kaufland'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products" prefetch={true}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{product.title}</h1>
            <Badge variant="outline" className="text-sm border-blue-200 text-blue-700 bg-blue-50">
              SKU: {product.sku || 'N/A'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex gap-2 text-sm">
            <span className="font-medium text-gray-900 border px-1 rounded bg-gray-50">EAN: {product.ean || 'N/A'}</span>
            <span>•</span>
            <span>Status: {product.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full overflow-x-auto justify-start border-b rounded-none h-auto p-0 bg-transparent scrollbar-hide flex-nowrap">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4">General</TabsTrigger>
          <TabsTrigger value="texts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4">Texts</TabsTrigger>
          <TabsTrigger value="prices" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 flex items-center gap-2">
            Prices 
            {(formData.marketplace_products?.some(mp => mp.is_custom_price) ? <div className="h-2 w-2 rounded-full bg-blue-500" /> : <div className="h-2 w-2 rounded-full bg-green-500" />)}
          </TabsTrigger>
          <TabsTrigger value="images" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4">Images</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4">Stock</TabsTrigger>
          <TabsTrigger value="stock-movements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4">Stock Movements</TabsTrigger>
          <TabsTrigger value="sources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-muted-foreground">Sources</TabsTrigger>
          <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-muted-foreground">Files</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-4 text-muted-foreground">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Title</Label>
                <Input value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>EAN</Label>
                <Input value={formData.ean || ''} onChange={e => setFormData({ ...formData, ean: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" value={formData.weight || 0} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Shipping Type</Label>
                <Input value={formData.shipping_type || ''} placeholder="e.g. DHL Paket" onChange={e => setFormData({ ...formData, shipping_type: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="texts" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Description</CardTitle></CardHeader>
              <CardContent>
                <Textarea className="min-h-[300px]" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">AI Optimization <Sparkles className="h-4 w-4" /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground p-4 bg-muted rounded border border-dashed text-center">
                  Generate SEO-optimized German content using DeepSeek/OpenAI.
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleOptimise}>
                  <Sparkles className="mr-2 h-4 w-4" /> Run AI Optimization
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Price Management</CardTitle>
                <CardDescription>Set master price or override for specific marketplaces</CardDescription>
              </div>
              <Button onClick={() => setIsPriceModalOpen(true)} variant="outline">Manage Overrides</Button>
            </CardHeader>
            <CardContent className="mt-4">
              <div className="max-w-xs space-y-2">
                <Label>Master Price (€)</Label>
                <Input type="number" step="0.01" value={formData.price || 0} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} className="text-lg font-bold h-12" />
                <p className="text-xs text-muted-foreground">Applies to all platforms by default.</p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Modal */}
          <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Marketplace Specific Prices</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center gap-2 font-semibold pb-4 border-b">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Master Price: €{(formData.price || 0).toFixed(2)}
                </div>
                {ALL_MARKETPLACES.map(mp => {
                  const mpData = formData.marketplace_products?.find(m => m.marketplace === mp);
                  const isCustom = mpData?.is_custom_price;
                  const currentPrice = isCustom && mpData.price ? mpData.price : formData.price || 0;

                  return (
                    <div key={mp} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 capitalize w-24">
                        <div className={`h-2 w-2 rounded-full ${isCustom ? 'bg-blue-500' : 'bg-green-500'}`} />
                        {mp}
                      </div>
                      <div className="font-medium w-20">€{currentPrice.toFixed(2)}</div>
                      <div className="flex gap-2">
                        {isCustom ? (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingMarketplacePrice({ marketplace: mp, price: currentPrice })}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => toggleCustomPrice(mp, true)}>Reset to Master</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => toggleCustomPrice(mp, false)}>Custom Price</Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>

          {/* Inline Edit Custom Price Dialog */}
          <Dialog open={!!editingMarketplacePrice} onOpenChange={(o) => !o && setEditingMarketplacePrice(null)}>
            <DialogContent className="sm:max-w-[300px]">
              <DialogHeader><DialogTitle className="capitalize">Edit {editingMarketplacePrice?.marketplace} Price</DialogTitle></DialogHeader>
              <Input 
                type="number" 
                step="0.01" 
                value={editingMarketplacePrice?.price || 0} 
                onChange={(e) => setEditingMarketplacePrice(prev => prev ? { ...prev, price: parseFloat(e.target.value) } : null)} 
              />
              <DialogFooter><Button onClick={saveCustomPrice}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="images" className="mt-6"><Card><CardContent className="p-10 text-center text-muted-foreground">Images tab content</CardContent></Card></TabsContent>
        <TabsContent value="sources" className="mt-6"><Card><CardContent className="p-10 text-center text-muted-foreground">Sources management coming soon</CardContent></Card></TabsContent>
        <TabsContent value="files" className="mt-6"><Card><CardContent className="p-10 text-center text-muted-foreground">File management coming soon</CardContent></Card></TabsContent>
        <TabsContent value="notes" className="mt-6"><Card><CardContent className="p-10 text-center text-muted-foreground">Internal notes coming soon</CardContent></Card></TabsContent>

        <TabsContent value="stock" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Stock Management</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 max-w-sm">
                <div className="space-y-2 flex-1">
                  <Label>Current Stock</Label>
                  <Input type="number" value={tempStock} onChange={e => setTempStock(parseInt(e.target.value))} />
                </div>
                <Button onClick={handleUpdateStock} disabled={tempStock === formData.quantity}>
                  Update Real-time
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock-movements" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Stock Movement History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No stock movements recorded yet.</TableCell></TableRow>
                  ) : (
                    stockMovements.map(mov => {
                      const d = new Date(mov.created_at)
                      return (
                        <TableRow key={mov.id}>
                          <TableCell>{d.toLocaleDateString()}</TableCell>
                          <TableCell>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell className={`font-medium ${mov.change > 0 ? 'text-green-600' : mov.change < 0 ? 'text-red-600' : ''}`}>
                            {mov.change > 0 ? '+' : ''}{mov.change}
                          </TableCell>
                          <TableCell>{mov.order_id || '-'}</TableCell>
                          <TableCell className="capitalize">{mov.platform}</TableCell>
                          <TableCell>{mov.user_name}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
