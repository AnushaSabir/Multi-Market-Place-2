"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/orders`, {
                headers: { 'x-api-key': token }
            });
            const { data } = await res.json();
            if (data) {
                setOrders(data);
            }
        } catch (e) {
            console.error("Failed to fetch orders", e);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateLabel = async (orderId: string) => {
        setGeneratingId(orderId);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/orders/${orderId}/dhl-label`, {
                method: 'POST',
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to generate label");
            }

            toast({ title: "Success", description: `Label generated! Tracking: ${data.trackingNumber}` });
            fetchOrders(); // Refresh to get the label URL and new state
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateInvoice = async (orderId: string) => {
        setGeneratingInvoiceId(orderId);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/orders/${orderId}/invoice`, {
                method: 'POST',
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || data.message || "Failed to generate invoice");
            }

            toast({ title: "Success", description: `Invoice ${data.invoiceNumber || 'generated'} & emailed!` });
            fetchOrders(); // Refresh to get the invoice URL
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setGeneratingInvoiceId(null);
        }
    };

    const handleCancelOrder = async (orderId: string) => {
        if (!confirm("Are you sure you want to cancel this order? Stock will be restored.")) return;
        
        setCancellingId(orderId);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || data.message || "Failed to cancel order");
            }

            toast({ title: "Order Cancelled", description: "The order has been cancelled and inventory restocked." });
            fetchOrders();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setCancellingId(null);
        }
    };

    if (loading) return <div className="p-6">Loading orders...</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                <p className="text-muted-foreground">Manage your synced orders matching Billbee's structure.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>All your marketplace orders centralized in one place.</CardDescription>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No orders synced yet. New marketplace orders will appear here automatically.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Marketplace</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-center">Shipping</TableHead>
                                    <TableHead className="text-center">Invoice</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.order_number}</TableCell>
                                        <TableCell className="capitalize">{order.marketplace}</TableCell>
                                        <TableCell>
                                            {order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : "Unknown"}
                                            <div className="text-xs text-muted-foreground">{order.customer?.email}</div>
                                        </TableCell>
                                        <TableCell>{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                                        <TableCell>
                                            <Badge variant={order.state === 'paid' ? 'default' : order.state === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">
                                                {order.state}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {order.total_price} {order.currency}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {order.dhl_tracking_number ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs font-mono bg-muted px-1 py-0.5 rounded text-blue-600">{order.dhl_tracking_number}</span>
                                                    {order.dhl_label_url && (
                                                        <a href={order.dhl_label_url} download={`DHL_Label_${order.order_number}.pdf`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                            <Printer className="w-3 h-3" /> Download Label
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateLabel(order.id)} disabled={generatingId === order.id}>
                                                    {generatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                                                    Generate Label
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col gap-2">
                                                {order.invoice_number ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-xs font-medium text-green-700 bg-green-50 px-1 py-0.5 rounded border border-green-200">
                                                            {order.invoice_number}
                                                        </span>
                                                        {order.invoice_url && (
                                                            <a href={order.invoice_url} download={`Rechnung_${order.order_number}.pdf`} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                                <Printer className="w-3 h-3" /> Download
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : order.state !== 'cancelled' ? (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGenerateInvoice(order.id)} disabled={generatingInvoiceId === order.id}>
                                                        {generatingInvoiceId === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Printer className="w-3 h-3 mr-1" />}
                                                        Generate
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                                {order.state !== 'cancelled' && order.state !== 'shipped' && (
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 mt-1" onClick={() => handleCancelOrder(order.id)} disabled={cancellingId === order.id}>
                                                        {cancellingId === order.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                                        Cancel Order
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
