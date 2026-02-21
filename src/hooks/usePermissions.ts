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

  // Retorna os hubs que o usuário tem acesso (filtrando rotas obsoletas e fundindo Campo/Escritório num mega hub Operacional)
  const getAccessibleHubs = (): Hub[] => {
    if (!permissions) return [];

    const hasOperacionalAccess = hasAccessToHub('campo') || hasAccessToHub('escritorio');

    // Removemos os dois hubs redundantes originais do banco de dados na hora de listar
    const filteredHubs = hubs.filter(hub =>
      hasAccessToHub(hub.code) &&
      hub.code !== 'campo' &&
      hub.code !== 'escritorio'
    );

    const processedHubs = filteredHubs.map(hub => {
      const newRoutes = hub.routes
        .filter(r => !r.startsWith('/relatorios')); // Relatórios foi movido para dentro, se mantido na raiz apagamos

      return {
        ...hub,
        routes: [...new Set(newRoutes)]
      };
    });

    // Se possui acesso a pelo menos um dos irmãos, nós o premiamos com o Hub Unificado
    if (hasOperacionalAccess) {
      const parentHubs = hubs.filter(h => h.code === 'campo' || h.code === 'escritorio');
      if (parentHubs.length > 0) {
        const lowestOrder = Math.min(...parentHubs.map(h => h.display_order));
        processedHubs.push({
          id: parentHubs[0].id,
          code: 'operacional',
          name: 'Operacional',
          routes: ['/protocolos', '/aspiracoes', '/transferencia', '/dg', '/sexagem', '/historico'],
          display_order: lowestOrder,
        });
      }
    }

    // Reordenar tudo pelo display_order após nossa injeção cirúrgica
    return processedHubs.sort((a, b) => a.display_order - b.display_order);
  };

  // Verifica se o usuário é admin
  const isAdmin = permissions?.isAdmin ?? false;

  // Verifica se o usuário é cliente
  const isCliente = permissions?.isCliente ?? false;

  // Verifica se o usuário é operacional
  const isOperacional = permissions?.profile?.user_type === 'operacional';

  // Retorna o perfil do usuário
  const profile = permissions?.profile ?? null;

  // Retorna o cliente_id se o usuário for do tipo cliente
  const clienteId = permissions?.profile?.cliente_id ?? null;

  // Verifica se o usuário tem permissões carregadas
  const hasPermissions = permissions !== null;

  // Mapeamento de rotas especiais para rotas de hub
  // Rotas que não estão diretamente no hub mas pertencem a ele
  const routeAliases: Record<string, string> = {
    '/receptoras': '/fazendas', // Histórico de receptoras pertence ao hub de fazendas
  };

  // Encontra o hub de uma rota específica
  const getHubForRoute = (route: string): Hub | null => {
    // Primeiro tenta encontrar diretamente
    const directMatch = hubs.find(hub =>
      hub.routes.some(r => route.startsWith(r))
    );
    if (directMatch) return directMatch;

    // Se não encontrou, verifica se há um alias para esta rota
    for (const [alias, target] of Object.entries(routeAliases)) {
      if (route.startsWith(alias)) {
        return hubs.find(hub =>
          hub.routes.some(r => target.startsWith(r))
        ) ?? null;
      }
    }

    return null;
  };

  // Retorna a primeira rota do primeiro hub acessível (para redirecionamento)
  const getDefaultRoute = (): string => {
    const accessibleHubs = getAccessibleHubs();
    if (accessibleHubs.length === 0) return '/sem-acesso';

    // Todos os tipos de usuário vão para o dashboard unificado
    return '/';
  };

  return {
    permissions,
    profile,
    isAdmin,
    isCliente,
    isOperacional,
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
