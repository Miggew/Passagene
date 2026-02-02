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

  return (
    <div className="space-y-6">
      {/* Header Premium com Logo */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 relative overflow-hidden">
        {/* Decoração de fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Lado esquerdo: Saudação */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {getSaudacao()}, {profile?.nome?.split(' ')[0] || 'Usuário'}
                </h1>
                <p className="text-sm text-muted-foreground">{getSubtitulo()}</p>
              </div>
            </div>
          </div>

          {/* Lado direito: Logo */}
          <div className="flex items-center justify-center md:justify-end">
            <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 p-4 shadow-sm">
              <img
                src={logoEscrito}
                alt="PassaGene"
                className="h-10 w-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard baseado no tipo de usuário */}
      {isAdmin && <HomeDashboardAdmin />}
      {isOperacional && !isAdmin && (
        <HomeDashboardOperacional clienteIds={clienteIds} />
      )}
      {isCliente && clienteId && (
        <HomeDashboardCliente
          clienteId={clienteId}
          clienteNome={clientes.find(c => c.id === clienteId)?.nome}
        />
      )}
    </div>
  );
}
