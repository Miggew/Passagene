import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { Home } from 'lucide-react';
import { routeIcons, routeLabelsLong as routeLabels } from '@/lib/nav-config';

export default function Sidebar() {
  const location = useLocation();
  const { isCliente, getHubForRoute, getAccessibleHubs } = usePermissions();

  const accessibleHubs = getAccessibleHubs();

  // Encontra o hub atual baseado na rota, ou força o único caso exista apenas 1
  let currentHub = getHubForRoute(location.pathname);
  if (!currentHub && accessibleHubs.length === 1) {
    currentHub = accessibleHubs[0];
  }

  const isRouteActive = (path: string) => {
    // Verifica match exato ou se é uma sub-rota (ex: /embrioes/123)
    // Evita que /embrioes-congelados ative /embrioes
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Clientes não veem sidebar - usam apenas a navegação mobile
  if (isCliente) {
    return null;
  }

  // Se não há hub atual, não mostra nada
  if (!currentHub) {
    return null;
  }

  return (
    <aside className="hidden md:flex w-72 bg-card/80 backdrop-blur-md border-r border-border/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] min-h-full flex-col rounded-r-[2rem]">
      {/* Header do hub atual */}
      <div className="p-6 border-b border-border/50">
        <h2 className="font-heading text-xl font-extrabold text-foreground">{currentHub.name}</h2>
        {currentHub.description && (
          <p className="text-xs text-muted-foreground mt-1">{currentHub.description}</p>
        )}
      </div>

      {/* Menu de navegação do hub */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {currentHub.routes.map((route) => {
          const Icon = routeIcons[route] || Home;
          const label = routeLabels[route] || route;
          const isActive = isRouteActive(route);

          return (
            <Link
              key={route}
              to={route}
              className={cn(
                'flex items-center gap-4 px-4 py-3 my-1.5 transition-all duration-300 relative',
                isActive
                  ? 'bg-primary/10 text-primary font-extrabold shadow-sm border-l-4 border-primary rounded-r-2xl pr-4' // Raiz ancorada na esquerda
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium rounded-2xl mx-3' // Item inativo tem margem padrão
              )}
            >
              <Icon className={cn('w-5 h-5 transition-transform duration-300', isActive ? 'text-primary scale-110' : '')} />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global AI Consultant Drop-In no rodapé do Sidebar */}
      <div className="p-4 border-t border-border/50">
        <Link
          to="/genia"
          className="group relative w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-light text-white py-3 rounded-2xl font-bold tracking-wide shadow-[0_4px_15px_rgba(9,201,114,0.3)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.5)] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          <LogoPassagene height={20} showText={false} variant="hollow" />
          <span className="relative z-10 group-hover:scale-105 transition-transform duration-300">Gen.IA</span>
        </Link>
      </div>
    </aside>
  );
}
