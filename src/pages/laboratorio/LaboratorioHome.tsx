
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { QuickActionCard } from '@/components/shared/QuickActionCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FlaskConical,
    TestTube,
    Snowflake,
    ArrowRightLeft,
    ChevronRight,
    Microscope
} from 'lucide-react';
import { useEmbryoScoreStats } from '@/components/admin/AdminEmbryoScoreTab';
import { Skeleton } from '@/components/ui/skeleton';

export default function LaboratorioHome() {
    const navigate = useNavigate();
    const { data: stats, isLoading } = useEmbryoScoreStats();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title="Hub Laboratório"
                description="Gestão centralizada de processos laboratoriais e análises embrionárias"
                icon={FlaskConical}
            />

            {/* Quick Actions Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <QuickActionCard
                    title="Cultivo (Lotes FIV)"
                    icon={TestTube}
                    description="Gerenciar lotes em andamento"
                    onClick={() => navigate('/lotes-fiv')}
                    color="blue"
                />
                <QuickActionCard
                    title="Congelamento"
                    icon={Snowflake}
                    description="Embriões vitrificados"
                    onClick={() => navigate('/embrioes-congelados')}
                    color="cyan"
                />
                <QuickActionCard
                    title="Transferências (TE)"
                    icon={ArrowRightLeft}
                    description="Registrar inovulações"
                    onClick={() => navigate('/transferencia')}
                    color="green"
                />
                <QuickActionCard
                    title="EmbryoScore AI"
                    icon={Microscope}
                    description="Análise de qualidade"
                    onClick={() => navigate('/embryoscore')}
                    color="violet"
                />
            </div>

            <div className="grid gap-6">
                {/* EmbryoScore Status Widget */}
                <Card className="border-l-4 border-l-violet-500 shadow-brutal-sm border-2 border-border rounded-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Microscope className="w-5 h-5 text-violet-600" />
                            Status EmbryoScore
                        </CardTitle>
                        <CardDescription>
                            Monitoramento em tempo real das análises de IA
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Fila</span>
                                    <span className="text-2xl font-bold text-foreground">{stats?.pendingJobs || 0}</span>
                                </div>
                                <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Erros</span>
                                    <span className={`text-2xl font-bold ${stats?.failedJobs ? 'text-red-500' : 'text-foreground'}`}>
                                        {stats?.failedJobs || 0}
                                    </span>
                                </div>
                                <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hoje</span>
                                    <span className="text-2xl font-bold text-foreground">{stats?.totalScores || 0}</span>
                                </div>
                                <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Média</span>
                                    <span className="text-2xl font-bold text-foreground">{Math.round(stats?.avgScore || 0)}</span>
                                </div>
                            </div>
                        )}
                        <div className="mt-4 flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => navigate('/embryoscore')}>
                                Ver Detalhes <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

