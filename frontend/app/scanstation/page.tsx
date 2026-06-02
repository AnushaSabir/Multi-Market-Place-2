"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, CheckCircle2, XCircle, PackageOpen, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ScanstationPage() {
    const [orderNumber, setOrderNumber] = useState("");
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
    const [skuInput, setSkuInput] = useState("");
    const [packing, setPacking] = useState(false);
    const [labelUrl, setLabelUrl] = useState<string | null>(null);

    const orderInputRef = useRef<HTMLInputElement>(null);
    const skuInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Focus order input on load
    useEffect(() => {
        orderInputRef.current?.focus();
    }, []);

    const fetchOrder = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!orderNumber.trim()) return;

        setLoading(true);
        setOrder(null);
        setScannedItems({});
        setLabelUrl(null);

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/scanstation/order/${orderNumber.trim()}`, {
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to fetch order");
            }

            setOrder(data.data);
            setTimeout(() => skuInputRef.current?.focus(), 100);
            toast({ title: "Order Loaded", description: `Please scan items for ${data.data.order_number}` });
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
            setOrderNumber("");
        } finally {
            setLoading(false);
        }
    };

    const handleScanSKU = (e: React.FormEvent) => {
        e.preventDefault();
        if (!order || !skuInput.trim()) return;

        const sku = skuInput.trim();
        
        // Check if SKU belongs to order
        const itemInOrder = order.items.find((item: any) => item.sku === sku);
        
        if (!itemInOrder) {
            // Wrong item scanned!
            toast({ 
                title: "❌ WRONG ITEM!", 
                description: `SKU ${sku} is not in this order!`, 
                variant: "destructive" 
            });
            // Play error sound (optional enhancement)
            const audio = new Audio('/error-sound.mp3');
            audio.play().catch(()=>console.log("Audio play blocked"));
        } else {
            // Correct item
            const currentCount = scannedItems[sku] || 0;
            if (currentCount >= itemInOrder.quantity) {
                toast({ title: "Over-scanned!", description: `You already scanned enough of ${sku}`, variant: "destructive" });
            } else {
                const newScanned = { ...scannedItems, [sku]: currentCount + 1 };
                setScannedItems(newScanned);
                
                // Check if totally completely packed now
                checkIfFullyPacked(newScanned);
            }
        }
        
        setSkuInput("");
    };

    const checkIfFullyPacked = async (currentScanned: Record<string, number>) => {
        let allPacked = true;
        for (const item of order.items) {
            const count = currentScanned[item.sku] || 0;
            if (count < item.quantity) {
                allPacked = false;
                break;
            }
        }

        if (allPacked) {
            toast({ title: "✅ Order Verified!", description: "Generating shipping label..." });
            handlePackAndShip();
        }
    };

    const handlePackAndShip = async () => {
        setPacking(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_URL}/api/scanstation/pack/${order.id}`, {
                method: 'POST',
                headers: { 'x-api-key': token }
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to generate label");
            }

            toast({ title: "Success", description: "Order Packed! Label Generated." });
            setLabelUrl(data.label.labelUrl);
            
            // Optionally clear to scan next order
            setTimeout(() => {
                setOrderNumber("");
                orderInputRef.current?.focus();
            }, 3000);
            
        } catch (e: any) {
            toast({ title: "Error Generating Label", description: e.message, variant: "destructive" });
        } finally {
            setPacking(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">ScanStation</h1>
                <p className="text-muted-foreground">Verify picked items and generate shipping labels.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Scanner Input Panel */}
                <Card className="border-blue-200 shadow-sm">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                        <CardTitle className="flex items-center text-blue-800">
                            <ScanLine className="w-5 h-5 mr-2" />
                            Scanner Input
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <form onSubmit={fetchOrder} className="space-y-2">
                            <label className="text-sm font-medium">1. Scan Order Barcode</label>
                            <div className="flex gap-2">
                                <Input 
                                    ref={orderInputRef}
                                    placeholder="Scan or type Order #" 
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    disabled={!!order || loading}
                                    className="font-mono text-lg py-6"
                                    autoFocus
                                />
                                {order ? (
                                    <Button type="button" variant="outline" onClick={() => { setOrder(null); setOrderNumber(""); }} className="h-auto">Reset</Button>
                                ) : (
                                    <Button type="submit" disabled={loading} className="h-auto w-24">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load"}
                                    </Button>
                                )}
                            </div>
                        </form>

                        <form onSubmit={handleScanSKU} className="space-y-2">
                            <label className={`text-sm font-medium ${!order ? "text-muted-foreground" : ""}`}>2. Scan Product Barcode (SKU)</label>
                            <div className="flex gap-2">
                                <Input 
                                    ref={skuInputRef}
                                    placeholder="Scan item SKU" 
                                    value={skuInput}
                                    onChange={(e) => setSkuInput(e.target.value)}
                                    disabled={!order || packing || !!labelUrl}
                                    className="font-mono text-lg py-6 border-blue-300 focus-visible:ring-blue-500"
                                />
                                <Button type="submit" disabled={!order || packing || !!labelUrl || !skuInput} className="h-auto bg-blue-600 hover:bg-blue-700">Verify</Button>
                            </div>
                        </form>

                        {labelUrl && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center space-y-3 mt-8">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                                <h3 className="font-bold text-green-800 text-lg">Order Complete!</h3>
                                <a href={labelUrl} target="_blank" className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors">
                                    <Printer className="w-5 h-5" /> Print DHL Label
                                </a>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Verification Panel */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <PackageOpen className="w-5 h-5 mr-2" />
                            Verification Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!order ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                Waiting for order scan...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-between items-start pb-4 border-b">
                                    <div>
                                        <h3 className="font-bold text-xl">{order.order_number}</h3>
                                        <p className="text-sm text-muted-foreground">{order.customer?.first_name} {order.customer?.last_name}</p>
                                    </div>
                                    <Badge variant="secondary" className="text-sm">{order.dhl_versandart || 'DHL Paket'}</Badge>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Items to Pack</h4>
                                    {order.items.map((item: any) => {
                                        const count = scannedItems[item.sku] || 0;
                                        const isComplete = count >= item.quantity;
                                        
                                        return (
                                            <div key={item.id} className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                                <div className="flex items-center gap-3">
                                                    {isComplete ? (
                                                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">{count}</div>
                                                    )}
                                                    <div>
                                                        <p className={`font-mono text-sm ${isComplete ? 'text-green-800' : 'font-bold'}`}>{item.sku}</p>
                                                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{item.title}</p>
                                                    </div>
                                                </div>
                                                <div className="text-lg font-bold">
                                                    <span className={isComplete ? 'text-green-600' : 'text-blue-600'}>{count}</span> / {item.quantity}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {packing && (
                                    <div className="flex items-center justify-center text-blue-600 py-4 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Generating Label & Invoice...
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
