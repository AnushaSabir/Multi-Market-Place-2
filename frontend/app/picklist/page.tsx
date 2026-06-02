"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CheckSquare, Loader2, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PicklistPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pickingId, setPickingId] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'created_at' | 'customer_name'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { toast } = useToast();

    useEffect(() => {
        fetchPicklist();
    }, []);

    const fetchPicklist = async () => {
        setLoading(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/picklist`, {
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            if (data.success) {
                setOrders(data.data);
            }
        } catch (e) {
            console.error("Failed to fetch picklist", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePick = async (orderId: string) => {
        setPickingId(orderId);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/picklist/${orderId}/pick`, {
                method: 'POST',
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to mark as picked");
            }

            toast({ title: "Success", description: `Order marked as picked! Ready for ScanStation.` });
            setOrders(orders.filter(o => o.id !== orderId)); // Remove from list instantly
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setPickingId(null);
        }
    };

    const handleSort = (field: 'created_at' | 'customer_name') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sortedOrders = [...orders].sort((a, b) => {
        if (sortField === 'customer_name') {
            return sortOrder === 'asc' 
                ? a.customer_name.localeCompare(b.customer_name)
                : b.customer_name.localeCompare(a.customer_name);
        } else {
            return sortOrder === 'asc'
                ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });

    if (loading) return <div className="p-6">Loading Picklist...</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Picklist</h1>
                <p className="text-muted-foreground">Orders ready to be picked. (Double orders are highlighted).</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>To Pick</CardTitle>
                    <CardDescription>Scan or verify these items from the warehouse shelves.</CardDescription>
                </CardHeader>
                <CardContent>
                    {sortedOrders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No orders waiting to be picked. Great job!
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('customer_name')} className="-ml-3 h-8 data-[active=true]:bg-muted">
                                            Customer <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('created_at')} className="-ml-3 h-8 data-[active=true]:bg-muted">
                                            Date <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Items to Pick</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedOrders.map((order) => (
                                    <TableRow key={order.id} className={!order.is_single_item ? "bg-amber-50/50 hover:bg-amber-50" : ""}>
                                        <TableCell className="font-medium">
                                            {order.order_number}
                                            {!order.is_single_item && <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">Multi-Item</Badge>}
                                        </TableCell>
                                        <TableCell>{order.customer_name}</TableCell>
                                        <TableCell>{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{order.dhl_versandart || 'Standard'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-2">
                                                {order.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center text-sm">
                                                        <Badge variant="outline" className="mr-2">{item.quantity}x</Badge>
                                                        <span className="font-mono text-xs text-muted-foreground mr-2">{item.sku}</span>
                                                        <span className="truncate max-w-[200px]">{item.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right align-top">
                                            <Button 
                                                onClick={() => handlePick(order.id)} 
                                                disabled={pickingId === order.id}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                {pickingId === order.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                                                Mark Picked
                                            </Button>
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
