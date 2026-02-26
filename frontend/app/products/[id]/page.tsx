"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Sparkles, RefreshCw, Store, ImageIcon, Save, AlertTriangle, Loader2 } from "lucide-react"
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
  marketplace_products?: {
    marketplace: string
    sync_status: string
    last_synced_at: string
    external_id: string
  }[]
}

export default function ProductDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Editing State
  const [formData, setFormData] = useState<Partial<Product>>({})

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
        const res = await fetch(`${API_URL}/api/products/${id}`, {
          headers: { 'x-api-key': 'Epic_Tech_2026' }
        })
        if (!res.ok) throw new Error("Product not found")
        const json = await res.json()
        setProduct(json.data)
        setFormData(json.data)
      } catch (error) {
        toast({ title: "Error", description: "Failed to load product details", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  const handleSave = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
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
      console.error("Save Error Details:", e);
      toast({ title: "Error", description: `Could not save changes: ${e.message}`, variant: "destructive" })
    }
  }

  const handleSync = async () => {
    toast({ title: "Syncing...", description: "Pushing updates to marketplaces..." })
    try {
      // Ideally we would trigger a specific sync endpoint here
      await handleSave();
    } catch (e) { }
  }

  const handleOptimise = async () => {
    toast({ title: "AI Optimization", description: "Generating new content..." })
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
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

  const handlePublish = async (marketplace: string) => {
    toast({ title: "Publishing...", description: `Sending product to ${marketplace.toUpperCase()}...` })
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API_URL}/api/products/${id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Epic_Tech_2026'
        },
        body: JSON.stringify({ marketplace })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Publish failed" }));
        throw new Error(errorData.error || "Failed to publish");
      }

      const result = await res.json()
      toast({
        title: "Success",
        description: `Product published to ${marketplace.toUpperCase()}`,
        className: "bg-green-600 text-white"
      })

      // Update local state to show it's connected
      setProduct(prev => {
        if (!prev) return null;
        const newMps = [...(prev.marketplace_products || [])];
        const existing = newMps.find(m => m.marketplace === marketplace);
        if (existing) {
          existing.sync_status = 'synced';
          existing.last_synced_at = new Date().toISOString();
          existing.external_id = result.external_id;
        } else {
          newMps.push({
            marketplace,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            external_id: result.external_id
          });
        }
        return { ...prev, marketplace_products: newMps };
      });

    } catch (e: any) {
      toast({ title: "Publish Error", description: e.message, variant: "destructive" })
    }
  }

  if (!product) return <div className="p-10 text-center">Product not found.</div>

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                <Store className="mr-2 h-4 w-4" /> Publish to...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handlePublish('ebay')}>eBay</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePublish('shopify')}>Shopify</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePublish('otto')}>Otto</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePublish('kaufland')}>Kaufland</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
          <Button onClick={handleSync}>
            <RefreshCw className="mr-2 h-4 w-4" /> Save & Sync
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start border-b rounded-none h-auto p-0 bg-transparent scrollbar-hide">
          <TabsTrigger value="basic" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6">Basic Info</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6">AI Optimization</TabsTrigger>
          <TabsTrigger value="sync" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6">Marketplace Sync</TabsTrigger>
          <TabsTrigger value="images" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-6">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
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
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price (€)</Label>
                    <Input type="number" step="0.01" value={formData.price || 0} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Stock</Label>
                    <Input type="number" value={formData.quantity || 0} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Description</CardTitle>
                <CardDescription>This is what is currently saved.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea className="min-h-[200px]" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    AI Optimization
                    <Sparkles className="h-4 w-4" />
                  </CardTitle>
                  <CardDescription>Generate SEO-optimized German content</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground p-4 bg-muted rounded border border-dashed text-center">
                  Click below to generate a new Title and Description using OpenAI.
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleOptimise}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI Optimization
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Dynamic Marketplace List */}
            {product.marketplace_products && product.marketplace_products.length > 0 ? (
              product.marketplace_products.map((mp, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg capitalize">
                        <Store className="h-5 w-5" />
                        {mp.marketplace}
                      </CardTitle>
                      <Badge variant={mp.sync_status === 'failed' ? "destructive" : "secondary"}>
                        {mp.sync_status || 'Synced'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Last sync:</span>
                        <span>{new Date(mp.last_synced_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono bg-muted p-1 rounded mt-1 overflow-hidden text-ellipsis">
                        ID: {mp.external_id}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-10">
                No marketplaces connected for this product yet.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sirv Image Hosting</CardTitle>
              <CardDescription>Manage your Sirv image URLs here. (Separate multiple URLs with commas)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Simplified Image Manager: Just a text area for URLs for V1 */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="flex items-center justify-center p-6 border-2 border-dashed rounded text-muted-foreground text-sm">
                    Image preview coming soon
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
