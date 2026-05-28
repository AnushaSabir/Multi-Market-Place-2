"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react"
import Loading from "@/app/loading"

// Default / Initial State
const initialStats = [
  { title: "Total Products", value: "-", icon: Package, color: "text-blue-600" },
  { title: "AI Optimized", value: "-", icon: CheckCircle2, color: "text-green-600" },
  { title: "Synced", value: "-", icon: RefreshCw, color: "text-indigo-600" },
  { title: "Sync Errors", value: "0", icon: AlertCircle, color: "text-red-600" },
]

const initialMarketplaces = [
  { name: "Otto", status: "online", lastSync: "check...", importedCount: 0 },
  { name: "eBay", status: "online", lastSync: "check...", importedCount: 0 },
  { name: "Kaufland", status: "online", lastSync: "check...", importedCount: 0 },
  { name: "Shopify", status: "online", lastSync: "check...", importedCount: 0 },
]

export default function DashboardPage() {
  const [stats, setStats] = useState(initialStats)
  const [marketplaces, setMarketplaces] = useState(initialMarketplaces)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API_URL}/api/products/stats`, {
        headers: { 'x-api-key': 'Epic_Tech_2026' }
      })
      if (!res.ok) throw new Error("Failed to fetch stats")

      const data = await res.json()

      // Update Top Stats
      setStats([
        { title: "Total Products", value: data.total.toString(), icon: Package, color: "text-blue-600" },
        { title: "AI Optimized", value: data.aiOptimized.toString(), icon: CheckCircle2, color: "text-green-600" },
        { title: "Synced", value: data.synced.toString(), icon: RefreshCw, color: "text-indigo-600" },
        { title: "Sync Errors", value: "0", icon: AlertCircle, color: "text-red-600" },
      ])

      // Update Marketplace Cards
      setMarketplaces([
        { name: "Otto", status: "online", lastSync: "Just now", importedCount: data.marketplaces.otto },
        { name: "eBay", status: "online", lastSync: "Just now", importedCount: data.marketplaces.ebay },
        { name: "Kaufland", status: "online", lastSync: "Just now", importedCount: data.marketplaces.kaufland },
        { name: "Shopify", status: "online", lastSync: "Just now", importedCount: data.marketplaces.shopify },
      ])

    } catch (error) {
      console.error("Dashboard Stats Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">EpicTec Marketplace</h1>
          <p className="text-muted-foreground mt-1">Manage your multi-channel e-commerce operations</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg bg-background shadow-sm border border-border/50 ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Marketplace Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {marketplaces.map((m) => (
              <div key={m.name} className="group flex items-center justify-between p-4 border border-border/50 rounded-xl bg-white/40 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`absolute -inset-1 rounded-full opacity-40 blur-sm ${m.status === "online" ? "bg-green-500" : "bg-amber-500"}`} />
                    <div className={`relative w-3 h-3 rounded-full border-2 border-background ${m.status === "online" ? "bg-green-500" : "bg-amber-500"}`} />
                  </div>
                  <div>
                    <span className="font-semibold block text-base">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.status === "online" ? "Connected" : "Check Connection"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl">{m.importedCount}</div>
                  <Link
                    href={`/products?marketplace=${m.name.toLowerCase()}`}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View Products
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {stats.recentMovements && stats.recentMovements.length > 0 ? (
                stats.recentMovements.map((move: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="mt-1 p-2 bg-primary/10 text-primary rounded-lg">
                      {move.change < 0 ? <RefreshCw className="h-4 w-4 text-orange-500" /> : <RefreshCw className="h-4 w-4 text-green-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{move.products?.title || 'Unknown Product'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {move.platform} • {move.type === 'order' ? 'Sold' : 'Manual'} • Stock changed by {move.change > 0 ? `+${move.change}` : move.change}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(move.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
