import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { LoadingInline } from '@/components/shared/LoadingScreen';
import LogoSimples from '@/assets/logosimples.svg';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { differenceInDays } from 'date-fns';

interface Props {
    clienteId?: string;
    compact?: boolean; // Keep for compatibility with the cockpit
}

export function AITeaserWidget({ clienteId, compact = true }: Props) {
    const navigate = useNavigate();
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

        const loadStatsAndAnalyze = async () => {
            setLoadingData(true);
            try {
                // 1. Get farms
                const { data: fazendas } = await supabase
                    .from('fazendas')
                    .select('id')
                    .eq('cliente_id', clienteId);

                const fazendaIds = fazendas?.map(f => f.id) || [];
                if (fazendaIds.length === 0) {
                    setLoadingData(false);
                    return;
                }

                // 2. Get receptoras stats
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
                    setLoadingAI(true);
                    try {
                        const { data, error } = await supabase.functions.invoke('fetch-gemini-insights', {
                            body: {
                                type: 'farm',
                                data: {
                                    total_receptoras: newStats.total,
                                    prenhes: newStats.pregnant,
                                    taxa_prenhez: newStats.pregnancyRate,
                                    em_protocolo: newStats.in_protocol,
                                    nascimentos_previstos_30d: newStats.births_forecast
                                }
                            }
                        });
                        if (data?.analysis) setAnalysis(data.analysis);
                    } catch (e) {
                        console.error(e);
                        // Fallback natural language string if functions fails or isn't deployed yet
                        setAnalysis(`${newStats.pregnancyRate}% de prenhez. ${newStats.in_protocol} receptoras prontas.`);
                    } finally {
                        setLoadingAI(false);
                    }
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            } finally {
                setLoadingData(false);
            }
        };

        loadStatsAndAnalyze();
    }, [clienteId]);

    return (
        <Card
            onClick={() => navigate('/cliente/ai-chat')}
            className="group flex flex-col h-full w-full overflow-hidden border-2 border-primary/20 bg-card shadow-md hover:shadow-lg hover:border-primary/40 transition-all duration-500 relative cursor-pointer"
        >
            {/* Very subtle elegant neutral shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="p-6 md:p-8 flex flex-col h-full z-10 relative">
                {/* Insight Text (Foco Total na Leitura - Editorial) */}
                <div className="flex-1 flex flex-col justify-center min-h-0 mb-4 py-2">
                    {loadingData || loadingAI ? (
                        <div className="flex flex-col gap-5 w-full">
                            <div className="h-6 w-full bg-muted/60 rounded animate-pulse" />
                            <div className="h-6 w-5/6 bg-muted/60 rounded animate-pulse" />
                            <div className="h-6 w-3/4 bg-muted/60 rounded animate-pulse" />
                        </div>
                    ) : (
                        <p className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed drop-shadow-sm group-hover:text-foreground/90 transition-colors">
                            {analysis}
                        </p>
                    )}
                </div>

                {/* Ação Elegante e Discreta (Restaurada para o verde agradável original) */}
                <div className="shrink-0 flex items-center justify-start mt-auto">
                    <span className="text-sm font-semibold text-primary group-hover:text-primary-light transition-colors flex items-center gap-2">
                        Ver relatório de I.A. detalhado <span className="group-hover:translate-x-1 transition-transform">➔</span>
                    </span>
                </div>
            </div>
        </Card>
    );
}
