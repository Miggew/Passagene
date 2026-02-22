import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { QuickActionCard } from '@/components/shared/QuickActionCard';
import { Card, CardContent } from '@/components/ui/card';
import {
    ThumbsUp,
    ArrowRightLeft,
    TestTube,
    Syringe,
    History,
    Bell,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { CowIcon } from '@/components/icons/CowIcon';

export default function CampoHome() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                title="Hub Campo"
                description="Gestão de atividades reprodutivas em campo"
                icon={CowIcon}
            />

            {/* Quick Actions Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                <QuickActionCard
                    title="Diagnóstico (DG)"
                    icon={ThumbsUp}
                    description="Avaliar gestação das receptoras"
                    onClick={() => navigate('/dg')}
                    color="green"
                />
                <QuickActionCard
                    title="Sexagem Fetal"
                    icon={GenderIcon}
                    description="Sexar gestações confirmadas"
                    onClick={() => navigate('/sexagem')}
                    color="blue"
                />
                <QuickActionCard
                    title="Transferência (TE)"
                    icon={ArrowRightLeft}
                    description="Registrar inovulações"
                    onClick={() => navigate('/transferencia')}
                    color="amber"
                />
                <QuickActionCard
                    title="Aspiração Folicular"
                    icon={TestTube}
                    description="Aspirar doadoras"
                    onClick={() => navigate('/aspiracoes')}
                    color="violet"
                />
                <QuickActionCard
                    title="Protocolos"
                    icon={Syringe}
                    description="Sincronização hormonal"
                    onClick={() => navigate('/protocolos')}
                    color="cyan"
                />
                <QuickActionCard
                    title="Histórico"
                    icon={History}
                    description="Sessões anteriores"
                    onClick={() => navigate('/historico')}
                    color="slate"
                />
            </div>

            {/* Seção de Avisos (placeholder para Fase 5) */}
            <Card>
                <CardContent className="py-8">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground rounded-lg p-8">
                        <Bell className="w-8 h-8 opacity-40" />
                        <p className="text-sm font-medium">Nenhum aviso pendente — tudo em dia!</p>
                        <p className="text-xs opacity-60">
                            Futuramente: DGs pendentes, protocolos vencendo, receptoras prontas
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
