"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                                            <Badge variant={order.state === 'paid' ? 'default' : 'secondary'} className="capitalize">
                                                {order.state}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {order.total_price} {order.currency}
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
