import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import { QuickActionCard } from '@/components/shared/QuickActionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    FlaskConical,
    TestTube,
    Snowflake,
    Microscope,
    AlertCircle,
    Loader2,
    Clock,
} from 'lucide-react';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

/** Lightweight stats for the Lab home dashboard */
function useLabDashboard() {
    return useQuery({
        queryKey: ['lab-dashboard'],
        queryFn: async () => {
            // Lotes em cultivo ativo (abertos)
            const { count: lotesAtivos } = await supabase
                .from('lotes_fiv')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'ABERTO');

            // Embriões frescos (prontos para despacho potencial)
            const { count: embrioesFrescos } = await supabase
                .from('embrioes')
                .select('*', { count: 'exact', head: true })
                .eq('status_atual', 'FRESCO');

            // Embriões congelados
            const { count: embrioesCongelados } = await supabase
                .from('embrioes')
                .select('*', { count: 'exact', head: true })
                .eq('status_atual', 'CONGELADO');

            // Fila de análise IA (pending + processing)
            const { data: queueJobs } = await supabase
                .from('embryo_analysis_queue')
                .select('status')
                .in('status', ['pending', 'processing']);

            const pending = queueJobs?.filter(j => j.status === 'pending').length || 0;
            const processing = queueJobs?.filter(j => j.status === 'processing').length || 0;

            // Jobs falhados
            const { count: failedJobs } = await supabase
                .from('embryo_analysis_queue')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'failed');

            return {
                lotesAtivos: lotesAtivos || 0,
                embrioesFrescos: embrioesFrescos || 0,
                embrioesCongelados: embrioesCongelados || 0,
                queuePending: pending,
                queueProcessing: processing,
                failedJobs: failedJobs || 0,
            };
        },
        refetchInterval: 15_000,
        staleTime: 10_000,
    });
}

export default function LaboratorioHome() {
    const navigate = useNavigate();
    const { data: stats, isLoading } = useLabDashboard();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title="Hub Laboratório"
                description="Produção, classificação e despacho de embriões"
                icon={FlaskConical}
            />

            {/* Quick Actions Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <QuickActionCard
                    title="Cultivo"
                    icon={TestTube}
                    description="Lotes FIV em andamento"
                    onClick={() => navigate('/lotes-fiv')}
                    color="blue"
                    badge={stats?.lotesAtivos ? `${stats.lotesAtivos}` : undefined}
                />
                <QuickActionCard
                    title="Embriões"
                    icon={EmbryoIcon}
                    description="Classificar e despachar"
                    onClick={() => navigate('/embrioes')}
                    color="amber"
                    badge={stats?.embrioesFrescos ? `${stats.embrioesFrescos}` : undefined}
                />
                <QuickActionCard
                    title="Congelados"
                    icon={Snowflake}
                    description="Inventário vitrificados"
                    onClick={() => navigate('/embrioes-congelados')}
                    color="cyan"
                    badge={stats?.embrioesCongelados ? `${stats.embrioesCongelados}` : undefined}
                />
                <QuickActionCard
                    title="Bancada IA"
                    icon={Microscope}
                    description="Avaliação com IA"
                    onClick={() => navigate('/bancada')}
                    color="violet"
                />
            </div>

            {/* Dashboard Cards */}
            {isLoading ? (
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                    {/* Fila de IA */}
                    {(stats?.queuePending || 0) + (stats?.queueProcessing || 0) > 0 && (
                        <Card className="rounded-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                    Análise IA
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline gap-3">
                                    {stats?.queueProcessing ? (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold text-blue-600">{stats.queueProcessing}</span>
                                            <span className="text-xs text-muted-foreground">processando</span>
                                        </div>
                                    ) : null}
                                    {stats?.queuePending ? (
                                        <div className="flex items-baseline gap-1">
                                            <Clock className="w-3 h-3 text-amber-500" />
                                            <span className="text-lg font-semibold text-amber-600">{stats.queuePending}</span>
                                            <span className="text-xs text-muted-foreground">na fila</span>
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Jobs falhados */}
                    {(stats?.failedJobs || 0) > 0 && (
                        <Card className="rounded-xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/bancada')}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Análises com Erro
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-destructive">{stats?.failedJobs}</span>
                                    <span className="text-xs text-muted-foreground">job(s) falhado(s)</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
