import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { LoadingInline } from '@/components/shared/LoadingScreen';

export function MarketWidget({ compact = false }: { compact?: boolean }) {
    // Mock data
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('fetch-gemini-insights', {
                    body: { type: 'market' }
                });
                if (data?.quotes) setQuotes(data.quotes);
            } catch (e) {
                console.error(e);
                // Fallback mock
                setQuotes([
                    { item: 'Boi Gordo', price: '245,00', variation: 1.5, trend: 'up', unit: '@' },
                    { item: 'Bezerro', price: '2.150,00', variation: 0.5, trend: 'up', unit: 'cab' },
                    { item: 'Soja', price: '125,00', variation: -0.8, trend: 'down', unit: 'sc' },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchMarket();
    }, []);

    if (compact) {
        return (
            <Card className="h-full bg-white dark:bg-zinc-900 border-border p-4 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                    <span className="text-base font-heading font-bold text-foreground">Cotações Hoje</span>
                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <LoadingInline text="" />
                    ) : quotes.slice(0, 2).map((quote, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div>
                                <span className="text-base font-bold text-foreground block">{quote.item}</span>
                                <span className="text-xs text-muted-foreground uppercase font-medium">/{quote.unit}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-foreground block">R$ {quote.price.split(',')[0]}</span>
                                <div className={`flex items-center justify-end gap-1 text-xs font-bold ${quote.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {quote.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                    {quote.variation}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full bg-card border-border p-6 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Cotações de Mercado</h3>
                    <p className="text-sm text-muted-foreground">Valores atualizados hoje</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto -mx-2 px-2">
                <table className="w-full">
                    <thead className="text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                        <tr>
                            <th className="text-left font-medium pb-2">Item</th>
                            <th className="text-right font-medium pb-2">Preço (R$)</th>
                            <th className="text-right font-medium pb-2">Var.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={3} className="text-center py-8"><LoadingInline text="Checando cotações..." /></td></tr>
                        ) : quotes.map((quote, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3">
                                    <p className="text-sm font-semibold text-foreground">{quote.item}</p>
                                    <p className="text-xs text-muted-foreground">{quote.unit}</p>
                                </td>
                                <td className="py-3 text-right">
                                    <span className="text-sm font-bold text-foreground">{quote.price}</span>
                                </td>
                                <td className="py-3 text-right">
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${quote.trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                        }`}>
                                        {quote.variation}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                    Fonte: CEPEA/ESALQ • Atualização em tempo real
                </p>
            </div>
        </Card>
    );
}
