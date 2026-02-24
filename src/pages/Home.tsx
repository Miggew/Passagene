import { useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserClientes } from '@/hooks/useUserClientes';
import { HUB_HOME_ROUTES } from '@/lib/nav-config';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { HomeCliente, HomeDefault } from '@/components/home';

export default function Home() {
  const navigate = useNavigate();
  const { isCliente, isOperacional, clienteId, getAccessibleHubs } = usePermissions();
  const { clienteIds, clientes, loading: loadingClientes } = useUserClientes();

  // Hubs reais (ignora hub que só tem "/")
  const realHubs = useMemo(
    () => getAccessibleHubs().filter(h => !(h.routes.length === 1 && h.routes[0] === '/')),
    [getAccessibleHubs]
  );

  // Redirecionamentos geridos globalmente após loading, não num effect local isolado
  // O redirect é renderizado na fase final do request.

  // --- GATEWAY DE REDIRECIONAMENTO (Não-Clientes) ---
  // Ordem de prioridade para a página inicial
  const priorityMap: Record<string, number> = useMemo(() => ({
    administrativo: 1,
    escritorio: 2,
    laboratorio: 3,
    genetica: 4,
  }), []);

  const targetRoute = useMemo(() => {
    if (realHubs.length > 0) {
      const bestHub = [...realHubs].sort((a, b) => {
        const pA = priorityMap[a.code] || 99;
        const pB = priorityMap[b.code] || 99;
        return pA - pB;
      })[0];
      return HUB_HOME_ROUTES[bestHub.code] || bestHub.routes.find(r => r !== '/') || '/';
    }
    return null;
  }, [realHubs, priorityMap]);

  useEffect(() => {
    if (targetRoute && !isCliente) {
      navigate(targetRoute, { replace: true });
    }
  }, [targetRoute, isCliente, navigate]);

  // Loading state para operacional e cliente
  if ((isCliente || isOperacional) && loadingClientes) {
    return <LoadingSpinner />;
  }

  // Se vai redirecionar, mostra loading
  if (!isCliente && realHubs.length === 1) {
    return <LoadingSpinner />;
  }

  // Cliente → redireciona direto para a tela Genética
  if (isCliente) {
    return <Navigate to="/genia" replace />;
  }

  if (targetRoute) {
    return <LoadingSpinner />;
  }

  // Fallback caso não ache rotas (muito raro)
  return <HomeDefault clienteIds={clienteIds} />;
}
