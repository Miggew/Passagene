
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FlaskConical,
    TestTube,
    Snowflake,
    ArrowRightLeft,
    ChevronRight,
    CalendarDays,
    Microscope,
    Baby
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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* EmbryoScore Status Widget */}
                <Card className="col-span-4 border-l-4 border-l-violet-500">
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
                                    <span className="text-2xl font-bold text-foreground">{stats?.totalScores || 0}</span> {/* Placeholder: totalScores is actually ALL time, need daily stats later */}
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

                {/* Calendar / Reminder Widget (Placeholder) */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-amber-500" />
                            Agenda do Dia
                        </CardTitle>
                        <CardDescription>
                            Atividades previstas para hoje
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Aspiração (Fazenda Sta. Luzia)</p>
                                    <p className="text-xs text-muted-foreground">08:00 - Veterinário João</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Transferência (Retiro Novo)</p>
                                    <p className="text-xs text-muted-foreground">14:00 - 15 receptoras</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                                Todas as atividades em dia
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Nascimento Forecast? Just an idea for Lab */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Baby className="w-5 h-5 text-pink-500" />
                        Previsão de Nascimentos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground flex items-center justify-center p-8 border-2 border-dashed rounded-lg">
                        Gráfico de previsões em desenvolvimento...
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

interface QuickActionCardProps {
    title: string;
    icon: React.ElementType;
    description: string;
    onClick: () => void;
    color: 'blue' | 'green' | 'violet' | 'cyan' | 'amber';
}

function QuickActionCard({ title, icon: Icon, description, onClick, color }: QuickActionCardProps) {
    const colorStyles = {
        blue: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:border-blue-300',
        green: 'bg-green-500/10 text-green-600 border-green-200 hover:border-green-300',
        violet: 'bg-violet-500/10 text-violet-600 border-violet-200 hover:border-violet-300',
        cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 hover:border-cyan-300',
        amber: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:border-amber-300',
    };

    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col justify-between p-6 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${colorStyles[color]} hover:bg-opacity-20`}
        >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5" />
            </div>
            <div className="space-y-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/70 dark:bg-black/20 backdrop-blur-sm`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg">{title}</h3>
            </div>
            <p className="text-sm opacity-80 mt-2">{description}</p>
        </div>
    );
}
