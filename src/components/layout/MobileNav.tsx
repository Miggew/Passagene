/**
 * Navegação mobile com barra inferior hub-aware.
 * Clientes: FAB flutuante (Gen.IA).
 * Não-clientes: barra flat com links diretos para hub home pages (multi-hub) ou hub home + 3 quick routes (single-hub).
 */

import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { Home } from 'lucide-react';
import { VoiceFAB } from '@/components/ui/VoiceFAB';
import {
  routeIcons,
  routeLabels,
  hubIcons,
  HUB_QUICK_ROUTES,
  HUB_HOME_ROUTES,
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
        'group flex flex-col items-center justify-center flex-1 h-full py-2 rounded-xl mx-0.5 transition-all relative',
        active
          ? 'text-gold'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className={cn('w-5 h-5 mb-1 transition-transform', active ? 'scale-110 text-foreground' : 'text-muted-foreground group-hover:scale-110 group-hover:text-foreground')} />
      <span className={cn("text-[10px] tracking-tight truncate max-w-[90%]", active ? "font-bold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground")}>{displayLabel}</span>
      {active && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-foreground" />}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Fundo Brutalista + Orgânico (Multi-Hub)
// ═══════════════════════════════════════════════════════════════════

function CurvedBottomNavBackground() {
  return (
    <div className="absolute bottom-0 w-full h-[88px] overflow-hidden pointer-events-none z-0">
      {/* SVG Background matching tailwind card / brutalist background */}
      <svg
        className="absolute bottom-0 w-full h-full text-card drop-shadow-[0_-5px_20px_rgba(0,0,0,0.5)] md:drop-shadow-[0_-5px_20px_rgba(0,0,0,0.15)]"
        viewBox="0 0 400 88"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        {/* Smooth organic cutout curve for the FAB. Hard top border line created with a separate path to simulate border-top for Brutalism */}
        <path d="M0,20 C0,20 120,20 150,20 C165,20 170,55 200,55 C230,55 235,20 250,20 C280,20 400,20 400,20 L400,88 L0,88 Z" />
        <path d="M0,20 C0,20 120,20 150,20 C165,20 170,55 200,55 C230,55 235,20 250,20 C280,20 400,20 400,20" stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ClienteBottomBar — FAB flutuante isolado (Gen.IA)
// ═══════════════════════════════════════════════════════════════════

function ClienteBottomBar() {
  const location = useLocation();
  const isGenIaRoute = isRouteActive(location.pathname, '/genia');

  // Na página Gen.IA, a barra unificada já tem o mic — FAB flutuante é redundante
  if (isGenIaRoute) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-auto safe-area-bottom">
      <VoiceFAB size="lg" />
    </div>
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

  const isGenIaRoute = isRouteActive(location.pathname, '/genia');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent safe-area-bottom pointer-events-none md:bottom-2 md:max-w-3xl md:mx-auto">
      <CurvedBottomNavBackground />

      {/* FAB Central Global: Consultor IA (Centered in cutout) — escondido na /genia pois a barra unificada já tem mic */}
      {!isGenIaRoute && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-50 transition-all duration-300 bottom-[24px]">
          <VoiceFAB size="lg" isBrutalistCenter />
        </div>
      )}

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
