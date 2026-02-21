import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Newspaper } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { LoadingInline } from '@/components/shared/LoadingScreen';

interface NewsItem {
    title: string;
    summary: string;
    category: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
}

interface QuoteItem {
    item: string;
    price: string;
    variation: number;
    trend: 'up' | 'down';
    unit: string;
}

export function MarketNewsWidget({ compact = false }: { compact?: boolean }) {
    const [quotes, setQuotes] = useState<QuoteItem[]>([]);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loadingMarket, setLoadingMarket] = useState(true);
    const [loadingNews, setLoadingNews] = useState(true);

    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const { data } = await supabase.functions.invoke('fetch-gemini-insights', {
                    body: { type: 'market' }
                });
                if (data?.quotes) setQuotes(data.quotes);
            } catch (e) {
                // Fallback mock
                setQuotes([
                    { item: 'Boi Gordo', price: '245,00', variation: 1.5, trend: 'up', unit: '@' },
                    { item: 'Bezerro', price: '2.150,00', variation: 0.5, trend: 'up', unit: 'cab' },
                ]);
            } finally {
                setLoadingMarket(false);
            }
        };

        const fetchNews = async () => {
            try {
                const { data } = await supabase.functions.invoke('fetch-gemini-insights', {
                    body: { type: 'news' }
                });
                if (data?.news) setNews(data.news);
            } catch (e) {
                // Fallback mock
                setNews([
                    {
                        title: 'Mercado de reposição aquecido: bezerro valoriza 5% nesta semana.',
                        summary: 'Alta demanda por animais de reposição impulsiona preços em MG e SP.',
                        category: 'Mercado',
                        sentiment: 'positive',
                    }
                ]);
            } finally {
                setLoadingNews(false);
            }
        };

        fetchMarket();
        fetchNews();
    }, []);

    const loading = loadingMarket || loadingNews;

    return (
        <Card className="h-full min-h-0 bg-card border-border/50 p-3 flex flex-col justify-between shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            {/* Topo: Cotações Essenciais */}
            <div className="flex-1 flex flex-col justify-center mb-3">
                <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-foreground uppercase tracking-widest">Mercado Hoje</span>
                </div>

                {loading ? (
                    <LoadingInline text="" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {quotes.slice(0, 2).map((quote, i) => (
                            <div key={i} className="flex justify-between items-center bg-muted/20 rounded-lg p-2 px-3 border border-border/30">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-foreground">{quote.item}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">/{quote.unit}</span>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <span className="text-sm font-bold text-foreground">R$ {quote.price.split(',')[0]}</span>
                                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${quote.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {quote.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(quote.variation)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Divisor Elegante */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-1 opacity-60" />

            {/* Base: Notícia de Destaque */}
            <div className="shrink-0 mt-3 relative group cursor-pointer">
                <div className="flex items-start gap-2">
                    <Newspaper className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 opacity-60" />
                    <div className="flex-1 min-w-0">
                        {loadingNews ? (
                            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                        ) : (
                            <p className="text-xs font-medium text-foreground/80 leading-relaxed line-clamp-2 pr-6 group-hover:text-foreground transition-colors">
                                {news[0]?.title || 'Acompanhe as notícias do agronegócio...'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
