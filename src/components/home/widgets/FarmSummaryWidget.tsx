import { Activity, Users } from 'lucide-react';
import { LogoLoader } from '@/components/shared/LogoLoader';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { differenceInDays } from 'date-fns';

// Helper to format stats for the AI
const formatStatsForAI = (stats: any) => {
    return {
        total_receptoras: stats.total,
        prenhes: stats.pregnant,
        taxa_prenhez: stats.pregnancyRate,
        em_protocolo: stats.in_protocol,
        nascimentos_previstos_30d: stats.births_forecast
    };
};

interface Props {
    compact?: boolean;
    clienteId?: string;
}

export function FarmSummaryWidget({ compact = false, clienteId }: Props) {
    const [stats, setStats] = useState({
        total: 0,
        pregnant: 0,
        pregnancyRate: 0,
        in_protocol: 0,
        births_forecast: 0
    });

    const [analysis, setAnalysis] = useState<string>('');
    const [loadingAI, setLoadingAI] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (!clienteId) return;

        const loadStats = async () => {
            setLoadingData(true);
            try {
                // 1. Get farms for this client
                const { data: fazendas } = await supabase
                    .from('fazendas')
                    .select('id')
                    .eq('cliente_id', clienteId);

                const fazendaIds = fazendas?.map(f => f.id) || [];
                if (fazendaIds.length === 0) {
                    setLoadingData(false);
                    return;
                }

                // 2. Get receptoras stats in one go
                const { data: receptoras } = await supabase
                    .from('receptoras')
                    .select('id, status_reprodutivo, data_provavel_parto')
                    .in('fazenda_atual_id', fazendaIds);

                if (receptoras) {
                    const total = receptoras.length;
                    const pregnant = receptoras.filter(r => r.status_reprodutivo?.includes('PRENHE')).length;
                    const in_protocol = receptoras.filter(r =>
                        r.status_reprodutivo === 'SINCRONIZADA' ||
                        r.status_reprodutivo === 'EM_SINCRONIZACAO'
                    ).length;

                    // Forecast births in next 30 days
                    const today = new Date();
                    const births_forecast = receptoras.filter(r => {
                        if (!r.data_provavel_parto) return false;
                        const d = differenceInDays(new Date(r.data_provavel_parto), today);
                        return d >= 0 && d <= 30;
                    }).length;

                    const pregnancyRate = total > 0 ? Math.round((pregnant / total) * 100) : 0;

                    const newStats = { total, pregnant, pregnancyRate, in_protocol, births_forecast };
                    setStats(newStats);

                    // 3. Call AI with real data
                    fetchAnalysis(newStats);
                }
            } catch (error) {
                console.error('Error loading farm stats:', error);
            } finally {
                setLoadingData(false);
            }
        };

        const fetchAnalysis = async (currentStats: any) => {
            setLoadingAI(true);
            try {
                const { data, error } = await supabase.functions.invoke('fetch-gemini-insights', {
                    body: {
                        type: 'farm',
                        data: formatStatsForAI(currentStats)
                    }
                });
                if (data?.analysis) setAnalysis(data.analysis);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingAI(false);
            }
        };

        loadStats();
    }, [clienteId]);

    if (compact) {
        return (
            <Card className="h-full bg-card border-border p-5 flex flex-col hover:border-primary/50 transition-colors group overflow-hidden relative">
                <div className="flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-foreground">Resumo</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-h-0 z-10">
                    {loadingData ? (
                        <div className="flex items-center gap-2 justify-center py-4">
                            <LogoLoader size={40} />
                        </div>
                    ) : (
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-3xl font-bold text-foreground tracking-tighter">{stats.pregnant}</span>
                            <span className="text-xs font-medium text-muted-foreground">prenhes</span>
                        </div>
                    )}

                    <div className="mt-2 text-xs text-muted-foreground">
                        <span className="text-emerald-500 font-bold">{stats.pregnancyRate}%</span> taxa de prenhez
                    </div>

                    {/* AI Micro Insight */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                        {loadingAI ? (
                            <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse" />
                        ) : (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed italic">
                                "{analysis || 'Analisando dados do rebanho...'}"
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full bg-card border-border p-6 overflow-hidden flex flex-col relative">
            <div className="flex justify-between items-start mb-6 z-10">
                <div>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Rebanho Total</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Animais registrados</p>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-border col-span-1 md:col-span-2 flex items-center justify-between gap-6">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Prenhes</p>
                        <p className="text-2xl font-bold text-foreground">{stats.pregnant}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Em Protocolo</p>
                        <p className="text-2xl font-bold text-foreground">{stats.in_protocol}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Nascimentos (30d)</p>
                        <p className="text-2xl font-bold text-foreground">{stats.births_forecast}</p>
                    </div>
                    <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {stats.pregnancyRate}% Taxa Global
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Análise do Gene (IA)
                </h4>
                {loadingAI ? (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-3 w-full bg-emerald-500/10 rounded"></div>
                        <div className="h-3 w-2/3 bg-emerald-500/10 rounded"></div>
                    </div>
                ) : (
                    <p className="text-sm text-emerald-200/80 leading-relaxed">
                        {analysis}
                    </p>
                )}
            </div>
        </Card>
    );
}
