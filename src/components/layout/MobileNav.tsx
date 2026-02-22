/**
 * Navegação mobile com barra inferior hub-aware.
 * Clientes: curva SVG + FAB central (AI Chat) + 4 slots fixos.
 * Não-clientes: barra flat com links diretos para hub home pages (multi-hub) ou hub home + 3 quick routes (single-hub).
 */

import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { Home } from 'lucide-react';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { VoiceFAB } from '@/components/ui/VoiceFAB';
import { GeniaLogo } from '@/components/ui/GeniaLogo';
import {
  routeIcons,
  routeLabels,
  hubIcons,
  HUB_QUICK_ROUTES,
  HUB_HOME_ROUTES,
  CLIENTE_NAV_ROUTES,
} from '@/lib/nav-config';
import type { Hub } from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────────────

function isRouteActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

/** Check if a hub is active based on the current pathname */
function isHubActive(pathname: string, hub: Hub, hubHomeRoute: string) {
  if (pathname === hubHomeRoute) return true;
  return hub.routes.some((route) => route !== '/' && isRouteActive(pathname, route));
}

// ─── Bottom Bar Item ───────────────────────────────────────────────

interface BarItemProps {
  route: string;
  pathname: string;
  icon?: React.ElementType;
  label?: string;
  isActive?: boolean;
}

function BarItem({ route, pathname, icon, label, isActive: forceActive }: BarItemProps) {
  const Icon = icon || routeIcons[route] || Home;
  const displayLabel = label || routeLabels[route] || route;
  const active = forceActive !== undefined ? forceActive : isRouteActive(pathname, route);

  return (
    <Link
      to={route}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full py-2 rounded-2xl mx-0.5 transition-all relative',
        active ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('w-5 h-5 mb-1 transition-transform', active && 'scale-110')} />
      <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{displayLabel}</span>
      {active && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Fundo Orgânico Compartilhado (Membrana Curva Perfeita)
// ═══════════════════════════════════════════════════════════════════

function CurvedBottomNavBackground() {
  return (
    <div className="absolute bottom-0 w-full h-[88px] overflow-hidden pointer-events-auto rounded-t-3xl md:rounded-2xl" style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.05))' }}>
      {/* 2000px wide SVG mapped down with xMidYMin slice avoids tablet distortion */}
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2 min-w-[2000px] h-[88px]"
        viewBox="0 0 2000 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMin slice"
      >
        {/* Curva geométrica precisa: afunda para "abraçar" uma bola de 64x64px com 6px de gap. */}
        <path
          d="M0 16 H 930 C 960 16, 960 66, 1000 66 C 1040 66, 1040 16, 1070 16 H 2000 V 88 H 0 Z"
          className="fill-card opacity-95 backdrop-blur-md"
        />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ClienteBottomBar — curva orgânica + FAB central (AI Chat)
// ═══════════════════════════════════════════════════════════════════

function ClienteBottomBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const leftRoutes = CLIENTE_NAV_ROUTES.slice(0, 2);
  const rightRoutes = CLIENTE_NAV_ROUTES.slice(2, 4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent safe-area-bottom pointer-events-none md:bottom-2 md:max-w-2xl md:mx-auto">
      <CurvedBottomNavBackground />

      {/* FAB Central: AI Chat */}
      <div className="absolute bottom-[28px] left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-20">
        <VoiceFAB size="xl" />
      </div>

      {/* Itens de Navegação (2 + espaço + 2) */}
      <div className="relative z-10 flex items-center justify-between h-[88px] px-2 pb-2 pointer-events-auto">
        <div className="flex h-full flex-1 pt-2">
          {leftRoutes.map((route) => (
            <BarItem key={route} route={route} pathname={location.pathname} />
          ))}
        </div>
        <div className="w-[100px] shrink-0" />
        <div className="flex h-full flex-1 pt-2">
          {rightRoutes.map((route) => (
            <BarItem key={route} route={route} pathname={location.pathname} />
          ))}
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StandardBottomBar — links diretos para hub home pages
// ═══════════════════════════════════════════════════════════════════

function StandardBottomBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getAccessibleHubs } = usePermissions();

  const accessibleHubs = getAccessibleHubs();

  // Hubs reais (filtra hub que só tem "/" e "relatorios", pois foi mesclado com escritorio)
  const realHubs = useMemo(() => {
    return accessibleHubs.filter(h => !(h.routes.length === 1 && h.routes[0] === '/') && h.code !== 'relatorios');
  }, [accessibleHubs]);

  const isSingleHub = realHubs.length === 1;

  // Single-hub: hub home + 3 quick routes
  const singleHubItems = useMemo(() => {
    if (!isSingleHub) return null;

    const hub = realHubs[0];
    if (!hub) return null;

    const hubHomeRoute = HUB_HOME_ROUTES[hub.code];
    const quickRoutes = HUB_QUICK_ROUTES[hub.code]?.slice(0, 3) || [];

    if (!hubHomeRoute) return null;

    return { hub, hubHomeRoute, quickRoutes };
  }, [isSingleHub, realHubs]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent safe-area-bottom pointer-events-none md:bottom-2 md:max-w-3xl md:mx-auto">
      <CurvedBottomNavBackground />

      {/* FAB Central Global: Consultor IA */}
      <div className="absolute bottom-[28px] left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-50">
        <VoiceFAB size="xl" />
      </div>

      {/* Itens de Navegação */}
      <div className="relative z-10 flex items-center justify-between h-[88px] px-2 pb-2 pointer-events-auto md:px-6">
        {singleHubItems ? (
          /* Single-hub: [Hub Home] + [quickRoute[0]] | FAB | [quickRoute[1]] + [quickRoute[2]] */
          <>
            <div className="flex h-full flex-1 justify-evenly pt-2 md:justify-end md:gap-8 md:pr-4">
              <BarItem
                route={singleHubItems.hubHomeRoute}
                pathname={location.pathname}
                icon={hubIcons[singleHubItems.hub.code]}
                label="Início"
                isActive={isHubActive(location.pathname, singleHubItems.hub, singleHubItems.hubHomeRoute) && location.pathname === singleHubItems.hubHomeRoute}
              />
              {singleHubItems.quickRoutes[0] && (
                <BarItem route={singleHubItems.quickRoutes[0]} pathname={location.pathname} />
              )}
            </div>
            <div className="w-[84px] shrink-0" /> {/* Espaço para o FAB */}
            <div className="flex h-full flex-1 justify-evenly pt-2 md:justify-start md:gap-8 md:pl-4">
              {singleHubItems.quickRoutes.slice(1, 3).map((route) => (
                <BarItem key={route} route={route} pathname={location.pathname} />
              ))}
            </div>
          </>
        ) : (
          /* Multi-hub: direct links to hub home pages */
          <>
            <div className="flex h-full flex-1 justify-evenly pt-2 md:justify-end md:gap-6 md:pr-2">
              {realHubs.slice(0, Math.ceil(realHubs.length / 2)).map((hub) => {
                const hubHomeRoute = HUB_HOME_ROUTES[hub.code] || hub.routes.find(r => r !== '/') || '/';
                const active = isHubActive(location.pathname, hub, hubHomeRoute);
                return (
                  <BarItem
                    key={hub.code}
                    route={hubHomeRoute}
                    pathname={location.pathname}
                    icon={hubIcons[hub.code]}
                    label={hub.name}
                    isActive={active}
                  />
                );
              })}
            </div>

            <div className="w-[84px] shrink-0" /> {/* Espaço para o FAB */}

            <div className="flex h-full flex-1 justify-evenly pt-2 md:justify-start md:gap-6 md:pl-2">
              {realHubs.slice(Math.ceil(realHubs.length / 2)).map((hub) => {
                const hubHomeRoute = HUB_HOME_ROUTES[hub.code] || hub.routes.find(r => r !== '/') || '/';
                const active = isHubActive(location.pathname, hub, hubHomeRoute);
                return (
                  <BarItem
                    key={hub.code}
                    route={hubHomeRoute}
                    pathname={location.pathname}
                    icon={hubIcons[hub.code]}
                    label={hub.name}
                    isActive={active}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MobileNav — entry point
// ═══════════════════════════════════════════════════════════════════

export default function MobileNav() {
  const { isCliente } = usePermissions();

  return isCliente ? <ClienteBottomBar /> : <StandardBottomBar />;
}
