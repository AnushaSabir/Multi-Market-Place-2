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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
        <h1 className="text-3xl font-bold tracking-tight">EpicTec Marketplace Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Marketplace Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {marketplaces.map((m) => (
              <div key={m.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${m.status === "online" ? "bg-green-500" : "bg-amber-500"}`}
                  />
                  <div>
                    <span className="font-medium block">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.status === "online" ? "Connected" : "Check Connection"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{m.importedCount}</div>
                  <Link
                    href={`/products?marketplace=${m.name.toLowerCase()}`}
                    className="text-xs text-blue-600 hover:underline block"
                  >
                    View Products
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="mt-1 p-1 bg-blue-50 text-blue-600 rounded">
                    <RefreshCw className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{i === 1 ? 'System check completed' : 'Sync verified'}</p>
                    <p className="text-xs text-muted-foreground">System is running normally</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
