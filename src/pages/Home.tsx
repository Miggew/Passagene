import { usePermissions } from '@/hooks/usePermissions';
import { useUserClientes } from '@/hooks/useUserClientes';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import logoEscrito from '@/assets/logoescrito.svg';
import {
  HomeDashboardCliente,
  HomeDashboardOperacional,
  HomeDashboardAdmin,
} from '@/components/home';

export default function Home() {
  const { isAdmin, isCliente, isOperacional, profile, clienteId } = usePermissions();
  const { clienteIds, clientes, loading: loadingClientes } = useUserClientes();

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

  // Loading state para operacional e cliente
  if ((isCliente || isOperacional) && loadingClientes) {
    return <LoadingSpinner />;
  }

  // Layout compacto para cliente (cabe na tela sem scroll)
  if (isCliente && clienteId) {
    return (
      <div className="flex flex-col overflow-y-auto" style={{ height: 'calc(100dvh - 16px - 96px)' }}>
        {/* Header compacto: Logo + Saudação */}
        <div className="flex items-center justify-between gap-3 pb-2 pr-12 shrink-0">
          <img src={logoEscrito} alt="PassaGene" className="h-9 w-auto" />
          <div className="shrink-0 text-right">
            <h1 className="text-base font-semibold text-foreground leading-tight">
              {getSaudacao()}, {profile?.nome?.split(' ')[0] || 'Usuário'}
            </h1>
            <p className="text-sm text-muted-foreground">{getSubtitulo()}</p>
          </div>
        </div>

        {/* Dashboard Cliente - flex-1 preenche tudo */}
        <HomeDashboardCliente
          clienteId={clienteId}
          clienteNome={clientes.find(c => c.id === clienteId)?.nome}
        />
      </div>
    );
  }

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
              {getSaudacao()}, {profile?.nome?.split(' ')[0] || 'Usuário'}
            </h1>
            <p className="text-sm text-muted-foreground">{getSubtitulo()}</p>
          </div>
        </div>
      </div>

      {/* Dashboard baseado no tipo de usuário */}
      {isAdmin && <HomeDashboardAdmin />}
      {isOperacional && !isAdmin && (
        <HomeDashboardOperacional clienteIds={clienteIds} />
      )}
    </div>
  );
}
