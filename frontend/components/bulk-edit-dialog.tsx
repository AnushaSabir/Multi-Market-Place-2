import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Product {
  id: string
  title: string
  sku: string
}

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSuccess: (updates: { price?: number, quantity?: number }) => void
}

export function BulkEditDialog({ open, onOpenChange, products, onSuccess }: BulkEditDialogProps) {
  const [priceStr, setPriceStr] = useState("")
  const [qtyStr, setQtyStr] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleBulkEdit = async () => {
    const price = priceStr ? parseFloat(priceStr) : undefined;
    const quantity = qtyStr ? parseInt(qtyStr) : undefined;

    if (price === undefined && quantity === undefined) {
      return toast({ title: "Error", description: "Please enter a value to update", variant: "destructive" });
    }

    setLoading(true)
    try {
      const updates: any = {};
      if (price !== undefined) updates.price = price;
      if (quantity !== undefined) updates.quantity = quantity;

      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
      
      // Update each product sequentially or concurrently
      await Promise.all(products.map(p => 
        fetch(`${API_URL}/api/products/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'Epic_Tech_2026' },
          body: JSON.stringify(updates)
        })
      ));

      toast({ title: "Success", description: `Updated ${products.length} products.` })
      onSuccess(updates)
      onOpenChange(false)
      setPriceStr("")
      setQtyStr("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit Products ({products.length} selected)</DialogTitle>
          <DialogDescription>
            Leave fields empty if you don't want to change them. These changes will apply to all selected products.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>New Price (€)</Label>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="e.g. 29.99"
              value={priceStr}
              onChange={e => setPriceStr(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>New Stock Quantity</Label>
            <Input 
              type="number" 
              placeholder="e.g. 50"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleBulkEdit} disabled={loading || (!priceStr && !qtyStr)} className="bg-blue-600 hover:bg-blue-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
