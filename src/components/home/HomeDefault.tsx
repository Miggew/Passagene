import { usePermissions } from '@/hooks/usePermissions';
import logoEscrito from '@/assets/logoescrito.svg';
import HomeDashboardOperacional from './HomeDashboardOperacional';
import HomeDashboardAdmin from './HomeDashboardAdmin';

interface HomeDefaultProps {
    clienteIds?: string[];
}

export default function HomeDefault({ clienteIds }: HomeDefaultProps) {
    const { isAdmin, isOperacional, isCliente, profile } = usePermissions();

    // Determinar saudação baseado no tipo de usuário
    const getSaudacao = () => {
        const hora = new Date().getHours();
        if (hora < 12) return 'Bom dia';
        if (hora < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const getSubtitulo = () => {
        if (isCliente) return 'Acompanhe suas fazendas e animais';
        if (isOperacional) return 'Visão geral dos clientes vinculados';
        return 'Visão geral do sistema';
    };

    return (
        <div className="space-y-4">
            {/* Header: Logo */}
            <div className="flex items-center">
                <img
                    src={logoEscrito}
                    alt="PassaGene"
                    className="h-8 w-auto"
                />
            </div>

            {/* Card de Saudação */}
            <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 relative overflow-hidden">
                {/* Decoração de fundo */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

                <div className="relative flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full bg-primary" />
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {getSaudacao()}, {profile?.nome?.split(' ')[0] ?? 'Usuário'}
                        </h1>
                        <p className="text-sm text-muted-foreground">{getSubtitulo()}</p>
                    </div>
                </div>
            </div>

            {/* Dashboard baseado no tipo de usuário */}
            {isAdmin && <HomeDashboardAdmin />}
            {isOperacional && !isAdmin && (
                <HomeDashboardOperacional clienteIds={clienteIds || []} />
            )}
        </div>
    );
}
