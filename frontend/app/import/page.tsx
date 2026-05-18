"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Upload, Store, AlertCircle, Square, Activity } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"

export default function ImportPage() {
  const { toast } = useToast()
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [recentImports, setRecentImports] = useState<any[]>([])

  // Polling for live activity
  useEffect(() => {
    let interval: any;
    if (isImporting) {
      interval = setInterval(async () => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        try {
          // Poll for latest imported products to show "live feed"
          const res = await fetch(`${API_URL}/api/products?limit=5`, {
            headers: { 'x-api-key': 'Epic_Tech_2026' }
          });
          const json = await res.json();
          if (json.data) {
            setRecentImports(json.data);
          }
        } catch (e) { console.error(e) }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isImporting]);

  const handleStopImport = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      await fetch(`${API_URL}/api/import/stop`, { method: 'POST' });
      toast({ title: "Stopping...", description: "Import will stop shortly." });
    } catch (e) {
      console.error(e);
    }
  }

  const handleMarketplaceImport = async (source: string) => {
    setIsImporting(true)
    toast({
      title: "Import started",
      description: `Connecting to ${source} API... please wait.`,
    })

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${API_URL}/api/import/${source.toLowerCase()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Epic_Tech_2026' // Using our internal key
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Import failed');

      toast({
        title: "Import Successful",
        description: `${data.message || 'Products imported'}. Count: ${data.count || 'Unknown'}`,
      })

    } catch (error: any) {
      console.error("Import Error:", error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Could not connect to backend.",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Product Import</h1>
      </div>

      <Tabs defaultValue="marketplace" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="file">CSV / Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {["Otto", "eBay", "Kaufland", "Shopify"].map((shop) => (
              <Card key={shop} className="relative overflow-hidden group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    {shop}
                  </CardTitle>
                  <CardDescription>Import products directly</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full bg-transparent"
                    variant="outline"
                    disabled={isImporting}
                    onClick={() => handleMarketplaceImport(shop)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 text-blue-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>Note: Products are automatically merged based on EAN (merge logic).</p>
          </div>
        </TabsContent>

        <TabsContent value="file" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Upload a CSV or Excel file (.csv, .xlsx)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed rounded-xl p-12 text-center space-y-4 bg-muted/20">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Select file or drag it here</p>
                  <p className="text-xs text-muted-foreground">Max. 50MB (CSV, XLSX)</p>
                </div>
                <Button variant="secondary" size="sm">
                  Choose File
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Column Mapping</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {["Title", "SKU", "EAN", "Price", "Quantity", "Image URLs"].map((field) => (
                    <div key={field} className="flex items-center gap-4">
                      <Label className="w-24 shrink-0">{field}</Label>
                      <Input placeholder={`Column in file for ${field}...`} />
                    </div>
                  ))}
                </div>
              </div>

              {isImporting && (
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Importing data...</span>
                      <p className="text-xs text-muted-foreground">Please wait while products are synchronized.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleStopImport}>
                      <Square className="mr-2 h-4 w-4 fill-current" />
                      Stop Import
                    </Button>
                  </div>
                  <Progress value={progress} className="h-2" />

                  {recentImports.length > 0 && (
                    <div className="mt-4 border rounded-lg p-4 bg-slate-50">
                      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700">
                        <Activity className="h-4 w-4" />
                        Live Activity
                      </div>
                      <div className="space-y-2">
                        {recentImports.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs items-center bg-white p-2 rounded border shadow-sm">
                            <span className="truncate max-w-[200px] font-medium">{p.title}</span>
                            <span className="text-muted-foreground">{p.ean}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isImporting && (
                <Button className="w-full md:w-auto" disabled={isImporting}>
                  Start Import
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
