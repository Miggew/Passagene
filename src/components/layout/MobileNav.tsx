/**
 * Navegação mobile — FAB flutuante (Gen.IA) para todos os tipos de usuário.
 * A barra inferior com itens de hub foi removida.
 */

import { useLocation } from 'react-router-dom';
import { VoiceFAB } from '@/components/ui/VoiceFAB';

function isRouteActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

export default function MobileNav() {
  const location = useLocation();
  const isGenIaRoute = isRouteActive(location.pathname, '/genia');

  // Na página Gen.IA, a barra unificada já tem o mic — FAB é redundante
  if (isGenIaRoute) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-auto safe-area-bottom">
      <VoiceFAB size="lg" />
    </div>
  );
}
