import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { VoiceFAB } from '@/components/ui/VoiceFAB';
import { Home } from 'lucide-react';
import { routeIcons, routeLabelsLong as routeLabels, HUB_HOME_ROUTES } from '@/lib/nav-config';

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
    <aside className="hidden md:flex w-72 min-h-screen relative bg-transparent z-40 pointer-events-none">

      {/* Composited Background with Vertical Curve - Perfect Hug */}
      <div className="absolute inset-0 pointer-events-auto flex flex-col w-[326px]" style={{ filter: 'drop-shadow(3px 0px 12px rgba(0,0,0,0.04))' }}>

        {/* Top Flexible Segment */}
        <div className="w-72 flex-1 glass-panel/90 backdrop-blur-md rounded-tr-[2rem]" />

        {/* Fixed Curve Segment (200px height). Aligns perfectly with the FAB. */}
        <div className="w-[326px] h-[200px] shrink-0 relative overflow-visible -mt-[1px] -mb-[1px]">
          <svg
            className="w-full h-full absolute"
            preserveAspectRatio="none"
            viewBox="0 0 326 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 
              Mathematically perfect bezier bump: 
              Centers exactly at y=100. Pushes out to x=326.
              Leaves exactly a ~6px gap hugging a 64px circle centered at x=288.
            */}
            <path
              d="M0 0 H288 V30 C288 60, 326 60, 326 100 C326 140, 288 140, 288 170 V200 H0 Z"
              className="fill-card opacity-90 backdrop-blur-md"
            />
          </svg>

          {/* FAB: Consultor IA (Aligned inside the curve exactly) */}
          <div className="absolute inset-0 flex items-center justify-end z-50">
            <div className="relative group mr-[6px]">
              <VoiceFAB size="lg" isSidebar />
              {/* Tooltip on hover */}
              <span className="absolute right-[80px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl glass-panel border border-border text-foreground font-bold text-[12px] whitespace-nowrap shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 origin-right">
                Gen.IA Relatórios
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Segment */}
        <div className="w-72 h-[40px] shrink-0 glass-panel/90 backdrop-blur-md rounded-br-[2rem]" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col w-72 h-full pointer-events-auto">
        {/* Header do hub atual */}
        <div className="p-6 border-b border-border/50">
          <h2 className="font-heading text-xl font-extrabold text-foreground">{currentHub.name}</h2>
          {currentHub.description && (
            <p className="text-xs text-muted-foreground mt-1">{currentHub.description}</p>
          )}
        </div>

        {/* Menu de navegação do hub */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto w-full">
          {/* Link "Visão Geral" para hub home */}
          {HUB_HOME_ROUTES[currentHub.code] && (() => {
            const hubHomeRoute = HUB_HOME_ROUTES[currentHub.code];
            const HubHomeIcon = routeIcons[hubHomeRoute] || Home;
            const isHubHomeActive = isRouteActive(hubHomeRoute);
            return (
              <>
                <Link
                  to={hubHomeRoute}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 my-1.5 transition-all duration-300 relative group border-2',
                    isHubHomeActive
                      ? 'bg-gold/10 text-gold font-bold border-gold/20 shadow-[0_0_15px_rgba(212,162,76,0.1)] rounded-xl'
                      : 'border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/80 hover:text-foreground font-medium rounded-xl'
                  )}
                >
                  {!isHubHomeActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold/40 rounded-r-md scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-300 ease-out" />
                  )}
                  <HubHomeIcon className={cn('w-5 h-5 transition-transform duration-300', isHubHomeActive ? 'text-foreground scale-110' : 'text-muted-foreground group-hover:scale-110 group-hover:text-foreground')} />
                  <span className={cn("text-sm relative z-10 transition-colors", isHubHomeActive ? "text-foreground font-bold" : "text-muted-foreground group-hover:text-foreground")}>Visão Geral</span>
                </Link>
                <div className="mx-6 border-b border-border/40 my-2" />
              </>
            );
          })()}
          {currentHub.routes.filter(route => route !== HUB_HOME_ROUTES[currentHub.code]).map((route) => {
            const Icon = routeIcons[route] || Home;
            const label = routeLabels[route] || route;
            const isActive = isRouteActive(route);

            return (
              <Link
                key={route}
                to={route}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 my-1.5 transition-all duration-300 relative group border-2',
                  isActive
                    ? 'bg-gold/10 text-gold font-bold border-gold/20 shadow-[0_0_15px_rgba(212,162,76,0.1)] rounded-xl'
                    : 'border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/80 hover:text-foreground font-medium rounded-xl'
                )}
              >
                {/* Efeito Seiva Lateral (Sliding bar on hover) */}
                {!isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold/40 rounded-r-md scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-300 ease-out" />
                )}

                <Icon className={cn('w-5 h-5 transition-transform duration-300', isActive ? 'text-foreground scale-110' : 'text-muted-foreground group-hover:scale-110 group-hover:text-foreground')} />
                <span className={cn("text-sm relative z-10 transition-colors", isActive ? "text-foreground font-bold" : "text-muted-foreground group-hover:text-foreground")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Transparent bottom spacer to align with curve */}
        <div className="h-[200px] w-full shrink-0" />
      </div>

    </aside>
  );
}
