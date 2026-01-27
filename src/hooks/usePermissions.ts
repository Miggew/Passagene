import { useAuth } from '@/contexts/AuthContext';
import { Hub } from '@/lib/types';

/**
 * Hook para gerenciar permissões do usuário
 * Fornece funções utilitárias para verificar acesso a hubs e rotas
 */
export function usePermissions() {
  const {
    permissions,
    hubs,
    hasAccessToHub,
    hasAccessToRoute,
  } = useAuth();

  // Retorna os hubs que o usuário tem acesso
  const getAccessibleHubs = (): Hub[] => {
    if (!permissions) return [];

    return hubs.filter(hub => hasAccessToHub(hub.code));
  };

  // Verifica se o usuário é admin
  const isAdmin = permissions?.isAdmin ?? false;

  // Verifica se o usuário é cliente
  const isCliente = permissions?.isCliente ?? false;

  // Retorna o perfil do usuário
  const profile = permissions?.profile ?? null;

  // Retorna o cliente_id se o usuário for do tipo cliente
  const clienteId = permissions?.profile?.cliente_id ?? null;

  // Verifica se o usuário tem permissões carregadas
  const hasPermissions = permissions !== null;

  // Encontra o hub de uma rota específica
  const getHubForRoute = (route: string): Hub | null => {
    return hubs.find(hub =>
      hub.routes.some(r => route.startsWith(r))
    ) ?? null;
  };

  // Retorna a primeira rota do primeiro hub acessível (para redirecionamento)
  const getDefaultRoute = (): string => {
    const accessibleHubs = getAccessibleHubs();
    if (accessibleHubs.length === 0) return '/sem-acesso';

    // Se for cliente, vai para o portal
    if (isCliente) return '/portal';

    // Retorna a primeira rota do primeiro hub
    const firstHub = accessibleHubs[0];
    return firstHub.routes[0] || '/';
  };

  return {
    permissions,
    profile,
    isAdmin,
    isCliente,
    clienteId,
    hasPermissions,
    hubs,
    hasAccessToHub,
    hasAccessToRoute,
    getAccessibleHubs,
    getHubForRoute,
    getDefaultRoute,
  };
}
