import { usePermissions } from '@/hooks/usePermissions';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
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
                <LogoPassagene height={44} variant="premium" />
            </div>

            {/* Brutalist Greeting Card (Elegant Brutalism Fusion) */}
            <div className="rounded-2xl border-2 border-border glass-panel p-6 md:p-8 relative overflow-hidden shadow-brutal">
                {/* 
                    Genetic/Organic Flow Pattern inside the Brutalist Box 
                    Creates the tension that defines "Elegant Brutalism" 
                */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/15 via-primary/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-xl pointer-events-none" />

                <div className="relative flex items-center gap-4 md:gap-6 z-10">
                    {/* Brutalist Stripe Anchor */}
                    <div className="w-1.5 h-14 md:h-16 rounded-full bg-primary shadow-[0_0_15px_rgba(9,201,114,0.4)]" />

                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                            {getSaudacao()},{' '}
                            <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-light mix-blend-plus-lighter drop-shadow-sm">
                                {profile?.nome?.split(' ')[0] ?? 'Usuário'}
                            </span>
                        </h1>
                        <p className="text-sm md:text-base font-semibold text-muted-foreground/90 tracking-wide uppercase">
                            {getSubtitulo()}
                        </p>
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
