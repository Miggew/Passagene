import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Users,
  Home,
  Dna,
  Syringe,
  TestTube,
  ArrowRightLeft,
  Stethoscope,
  Activity,
  Sparkles,
  LogOut,
  FlaskConical,
  FileBox,
  Shield,
  LayoutDashboard,
  Snowflake,
} from 'lucide-react';

// Mapeamento de ícones por rota
const routeIcons: Record<string, React.ElementType> = {
  '/clientes': Users,
  '/fazendas': Home,
  '/usuarios': Shield,
  '/portal': LayoutDashboard,
  '/doadoras': Dna,
  '/touros': Sparkles,
  '/lotes-fiv': TestTube,
  '/embrioes': FileBox,
  '/embrioes-congelados': Snowflake,
  '/doses-semen': FlaskConical,
  '/protocolos': Syringe,
  '/aspiracoes': TestTube,
  '/transferencia': ArrowRightLeft,
  '/dg': Stethoscope,
  '/sexagem': Activity,
};

// Labels das rotas
const routeLabels: Record<string, string> = {
  '/clientes': 'Clientes',
  '/fazendas': 'Fazendas',
  '/usuarios': 'Usuários',
  '/portal': 'Meu Portal',
  '/doadoras': 'Doadoras',
  '/touros': 'Catálogo de Touros',
  '/lotes-fiv': 'Lotes FIV',
  '/embrioes': 'Embriões/Estoque',
  '/embrioes-congelados': 'Embriões Congelados',
  '/doses-semen': 'Doses de Sêmen',
  '/protocolos': 'Protocolos',
  '/aspiracoes': 'Aspirações',
  '/transferencia': 'Transferência (TE)',
  '/dg': 'Diagnóstico Gestação',
  '/sexagem': 'Sexagem',
};

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { getHubForRoute, profile } = usePermissions();

  // Encontra o hub atual baseado na rota
  const currentHub = getHubForRoute(location.pathname);

  const isRouteActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  // Se não há hub atual, não mostra nada (ou mostra vazio)
  if (!currentHub) {
    return null;
  }

  return (
    <div className="w-64 bg-slate-900 text-white min-h-full flex flex-col">
      {/* Header do hub atual */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">{currentHub.name}</h2>
        {currentHub.description && (
          <p className="text-xs text-slate-400 mt-1">{currentHub.description}</p>
        )}
      </div>

      {/* Menu de navegação do hub */}
      <nav className="flex-1 p-4 space-y-1">
        {currentHub.routes.map((route) => {
          const Icon = routeIcons[route] || Home;
          const label = routeLabels[route] || route;
          const isActive = isRouteActive(route);

          return (
            <Link
              key={route}
              to={route}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Area do usuario e logout */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {/* Nome e email do usuario logado */}
        {profile && (
          <div className="px-1">
            <p className="text-sm text-white font-medium truncate" title={profile.nome}>
              {profile.nome}
            </p>
            <p className="text-xs text-slate-400 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
        )}

        {/* Botao de logout */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
