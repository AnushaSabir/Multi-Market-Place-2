import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Store, Globe, Database, ShieldCheck } from "lucide-react"
import { PricingRulesSettings } from "@/components/pricing-rules-settings"

const platforms = [
  { name: "Otto", type: "Marketplace", status: "connected" },
  { name: "eBay", type: "Marketplace", status: "connected" },
  { name: "Kaufland", type: "Marketplace", status: "connected" },
  { name: "Shopify", type: "Shop System", status: "connected" },
  { name: "Billbee", type: "ERP / Inventory", status: "disconnected" },
  { name: "Sirv", type: "Image Hosting", status: "connected" },
]

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="grid gap-6">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Marketplace & System Integrations
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platforms.map((p) => (
              <Card key={p.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <Badge variant={p.status === "connected" ? "secondary" : "outline"}>
                      {p.status === "connected" ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <CardDescription>{p.type}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    {p.status === "connected" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Last validated: Today
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        API connection required
                      </>
                    )}
                  </div>
                  <Button variant={p.status === "connected" ? "outline" : "default"} className="w-full">
                    {p.status === "connected" ? "Reconnect" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Security & API Keys
            </CardTitle>
            <CardDescription>
              Your credentials are securely managed in the backend and never stored in the frontend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg border flex gap-4 items-center">
              <Database className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Centralized Credentials Management</p>
                <p className="text-sm text-muted-foreground">
                  The MultiMarket backend uses encrypted vaults for all marketplace tokens.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <PricingRulesSettings />
      </div>
    </div>
  )
}
