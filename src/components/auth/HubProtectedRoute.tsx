import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface HubProtectedRouteProps {
  children: React.ReactNode;
  hubCode?: string; // Se especificado, verifica acesso a esse hub específico
}

/**
 * Componente que protege rotas baseado nas permissões de hub do usuário
 *
 * Uso:
 * <HubProtectedRoute hubCode="laboratorio">
 *   <LotesFIV />
 * </HubProtectedRoute>
 *
 * Ou sem hubCode para verificar automaticamente pela rota:
 * <HubProtectedRoute>
 *   <LotesFIV />
 * </HubProtectedRoute>
 */
export function HubProtectedRoute({ children, hubCode }: HubProtectedRouteProps) {
  const { loading, permissions, hasAccessToHub, hasAccessToRoute } = useAuth();
  const location = useLocation();

  // Ainda carregando autenticação ou permissões
  if (loading || !permissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Verifica acesso
  let hasAccess = false;

  if (hubCode) {
    // Verifica pelo código do hub especificado
    hasAccess = hasAccessToHub(hubCode);
  } else {
    // Verifica automaticamente pela rota atual
    hasAccess = hasAccessToRoute(location.pathname);
  }

  // Sem acesso, redireciona
  if (!hasAccess) {
    return <Navigate to="/sem-acesso" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
