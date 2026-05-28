import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Product {
  id: string
  title: string
  sku: string
  quantity: number
  price: number
}

interface MergeProductsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSuccess: () => void
}

export function MergeProductsDialog({ open, onOpenChange, products, onSuccess }: MergeProductsDialogProps) {
  const [masterId, setMasterId] = useState<string>("")
  const [priceStrategy, setPriceStrategy] = useState<string>("master")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const combinedStock = products.reduce((acc, p) => acc + (p.quantity || 0), 0)

  const handleMerge = async () => {
    if (!masterId) return toast({ title: "Error", description: "Select a master product first", variant: "destructive" });
    
    setLoading(true)
    try {
      const productIdsToMerge = products.map(p => p.id).filter(id => id !== masterId)
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
      const res = await fetch(`${API_URL}/api/products/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
        body: JSON.stringify({
          masterProductId: masterId,
          productIdsToMerge,
          newStock: combinedStock,
          priceStrategy
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to merge products");
      }

      toast({ title: "Success", description: "Products merged successfully" })
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: "Merge Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Merge Products ({products.length} selected)</DialogTitle>
          <DialogDescription>
            Consolidate duplicate products into a single master product. All marketplace connections will be transferred to the master product.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Products to merge:</h4>
            <div className="bg-muted p-3 rounded-md space-y-2 max-h-[150px] overflow-y-auto">
              {products.map(p => (
                <div key={p.id} className="text-sm flex justify-between">
                  <span>✓ {p.title} <span className="text-xs text-muted-foreground">(SKU: {p.sku || '-'})</span></span>
                  <span className="font-medium">Stock: {p.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Master Product</label>
              <Select value={masterId} onValueChange={setMasterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select which product becomes the main one" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title} (SKU: {p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Price Strategy</label>
              <Select value={priceStrategy} onValueChange={setPriceStrategy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select how to handle prices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Use Master Product's Price</SelectItem>
                  <SelectItem value="highest">Keep Highest Price</SelectItem>
                  <SelectItem value="average">Calculate Average Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md">
              <p><strong>Combined Stock:</strong> {combinedStock} units</p>
              <p className="text-xs mt-1 opacity-80">The master product will be updated with this new total stock, and a stock movement log will be created. The other {products.length - 1} products will be deleted.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleMerge} disabled={!masterId || loading} className="bg-blue-600 hover:bg-blue-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
