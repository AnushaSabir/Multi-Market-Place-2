"use client"

import { LayoutDashboard, Package, Download, Settings, BarChart3, RefreshCcw, ShoppingCart, CheckSquare, ScanLine } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Products", url: "/products", icon: Package },
  { title: "Picklist", url: "/picklist", icon: CheckSquare },
  { title: "ScanStation", url: "/scanstation", icon: ScanLine },
  { title: "Import", url: "/import", icon: Download },
  { title: "Statistics", url: "/statistics", icon: BarChart3 },
  { title: "Sync", url: "/sync", icon: RefreshCcw },
  { title: "Settings", url: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-white dark:bg-background">
      <SidebarHeader className="border-b border-border/50 px-4 py-4 mb-4">
        <div className="flex items-center gap-2 font-bold text-xl px-2">
          <div className="relative h-12 w-40 overflow-hidden">
            <Image src="/logo.png" alt="EpicTec Logo" fill className="object-contain" priority />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {menuItems.map((item) => {
                const isActive = pathname?.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title}
                      isActive={isActive}
                      className={`
                        transition-all duration-300 ease-in-out font-medium
                        ${isActive 
                          ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                        }
                      `}
                    >
                      <Link href={item.url} prefetch={true} className="flex items-center gap-3 py-2 px-3">
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
