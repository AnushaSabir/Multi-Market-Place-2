import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { PageTransition } from "@/components/page-transition"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-background">
              <div className="p-4 border-b flex items-center bg-white/80 dark:bg-background/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <SidebarTrigger />
                <span className="ml-3 font-semibold text-foreground">Menu</span>
              </div>
              <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
          </div>
        </SidebarProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
