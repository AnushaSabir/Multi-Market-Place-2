"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

const MARKETPLACES = ['otto', 'kaufland', 'ebay', 'shopify'];

export function PricingRulesSettings() {
    const [rules, setRules] = useState<Record<string, { operator: string, value: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            const res = await fetch(`${API_BASE_URL}/api/settings/pricing-rules`, {
                headers: { 'x-api-key': token }
            });
            const { data } = await res.json();
            const newRules: Record<string, { operator: string, value: string }> = {};
            if (data) {
                data.forEach((r: any) => {
                    try {
                        const parsed = JSON.parse(r.auto_price_rule);
                        newRules[r.marketplace] = { operator: parsed.operator, value: String(parsed.value) };
                    } catch (e) {}
                });
            }
            setRules(newRules);
        } catch (e) {
            console.error("Failed to load rules", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('epic_tech_token') || 'Epic_Tech_2026';
            
            const payload = MARKETPLACES.map(mp => {
                const r = rules[mp];
                return {
                    marketplace: mp,
                    operator: r?.operator || '+',
                    value: r?.value ? parseFloat(r.value) : 0
                };
            }).filter(r => r.value !== 0);

            const res = await fetch(`${API_BASE_URL}/api/settings/pricing-rules`, {
                method: 'POST',
                headers: { 
                    'x-api-key': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rules: payload })
            });

            if (res.ok) {
                toast.success("Pricing rules saved successfully!");
            } else {
                toast.error("Failed to save rules.");
            }
        } catch (e) {
            console.error("Save error", e);
            toast.error("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    const updateRule = (mp: string, field: 'operator' | 'value', val: string) => {
        setRules(prev => ({
            ...prev,
            [mp]: {
                ...(prev[mp] || { operator: '+', value: '' }),
                [field]: val
            }
        }));
    };

    if (loading) return <div>Loading rules...</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Auto-Sync Pricing Rules
                </CardTitle>
                <CardDescription>
                    Automatically calculate marketplace prices based on the Master Price. Leave empty to use exact Master Price.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {MARKETPLACES.map(mp => (
                        <div key={mp} className="p-4 bg-muted/30 rounded-lg border space-y-3">
                            <p className="font-semibold capitalize text-center">{mp}</p>
                            <div className="flex gap-2">
                                <Select 
                                    value={rules[mp]?.operator || '+'} 
                                    onValueChange={(val) => updateRule(mp, 'operator', val)}
                                >
                                    <SelectTrigger className="w-[80px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="+">+ ($)</SelectItem>
                                        <SelectItem value="-">- ($)</SelectItem>
                                        <SelectItem value="+%">+ (%)</SelectItem>
                                        <SelectItem value="-%">- (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={rules[mp]?.value || ''}
                                    onChange={(e) => updateRule(mp, 'value', e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Pricing Rules'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
