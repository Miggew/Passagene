/**
 * Navegação mobile com barra inferior hub-aware e efeito Mitose.
 * Clientes: curva SVG + FAB central (AI Chat) + 4 slots fixos.
 * Não-clientes: barra flat com 5 slots (hubs ou rotas rápidas) e interação hover/click (Mitose) sem Menu lateral.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { Home } from 'lucide-react';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import {
  routeIcons,
  routeLabels,
  hubIcons,
  HUB_QUICK_ROUTES,
  CLIENTE_NAV_ROUTES,
} from '@/lib/nav-config';
import type { Hub } from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────────────

function isRouteActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

// ─── Bottom Bar Item ───────────────────────────────────────────────

function BarItem({ route, pathname, onClick }: { route: string; pathname: string; onClick?: () => void }) {
  const Icon = routeIcons[route] || Home;
  const label = routeLabels[route] || route;
  const isActive = isRouteActive(pathname, route);

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex flex-col items-center justify-center flex-1 h-full py-2 rounded-2xl mx-0.5 transition-all relative',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <Icon className={cn('w-5 h-5 mb-1 transition-transform', isActive && 'scale-110')} />
        <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{label}</span>
        {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
      </button>
    );
  }

  return (
    <Link
      to={route}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full py-2 rounded-2xl mx-0.5 transition-all relative',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className={cn('w-5 h-5 mb-1 transition-transform', isActive && 'scale-110')} />
      <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{label}</span>
      {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
    </Link>
  );
}

// ─── Hub Button (Mitosis mode) ─────────────────────────────────────

function HubButton({ hub, isActive, isOpen, routes, onToggle }: { hub: Hub, isActive: boolean, isOpen: boolean, routes: string[], onToggle: () => void }) {
  const { pathname } = useLocation();
  const Icon = hubIcons[hub.code] || Home;

  return (
    <div className="relative flex-[1.2] flex flex-col items-center justify-center h-full mx-0.5 mitosis-container">
      {/* Full-Screen Glassmorphic Dashboard Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-background/50 dark:bg-black/60 backdrop-blur-md transition-all duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onToggle();
          }
        }}
      >
        <span className={cn(
          "text-2xl font-black mb-10 tracking-tight transition-all duration-500 ease-out text-foreground drop-shadow-sm",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"
        )}>
          {hub.name}
        </span>

        <div className="grid grid-cols-3 gap-x-4 gap-y-6 w-full max-w-[340px] place-items-center">
          {routes.map((route, i) => {
            const RouteIcon = routeIcons[route] || Home;
            const label = route === '/relatorios' ? 'Relatórios' : (routeLabels[route] || route);
            const isRouteActivenow = isRouteActive(pathname, route);

            // Explosão em cascata vindo do centro da tela para fora
            const delay = isOpen ? (i * 60) : 0;

            return (
              <Link
                key={route}
                to={route}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                style={{ transitionDelay: `${delay}ms` }}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-3 w-[100px] h-[100px] rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-75 translate-y-8",
                  isRouteActivenow
                    ? "bg-primary text-primary-foreground shadow-[0_8px_32px_rgba(9,201,114,0.4)]"
                    : "bg-background/90 shadow-xl hover:bg-muted text-foreground"
                )}
              >
                <RouteIcon className={cn("w-8 h-8 transition-transform duration-300", isRouteActivenow ? "scale-110" : "opacity-80")} />
                <span className="text-[12px] font-bold tracking-tight text-center leading-tight px-1">
                  {label}
                </span>

                {isRouteActivenow && (
                  <div className="absolute inset-0 border-2 border-white/20 dark:border-black/20 rounded-3xl pointer-events-none" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <button
        onClick={onToggle}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full py-2 rounded-2xl transition-colors relative z-10",
          isOpen ? "text-primary" : "text-muted-foreground"
        )}
      >
        <div className={cn(
          "absolute inset-0 rounded-2xl transition-all duration-300 pointer-events-none",
          isOpen ? "bg-primary/10 scale-100 opacity-100" : "scale-90 opacity-0"
        )} />
        <Icon className={cn('w-5 h-5 mb-1 transition-transform duration-300', isOpen && 'scale-110')} />
        <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{hub.name}</span>
      </button>
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
      {/* Curva Orgânica — SVG Background */}
      <div className="absolute bottom-0 w-full h-[88px] pointer-events-auto">
        <svg
          className="absolute bottom-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 375 88"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 88V16H115.5C125 16 137.5 16 148 29.5C158.5 43 168.5 56 187.5 56C206.5 56 216.5 43 227 29.5C237.5 16 250 16 259.5 16H375V88H0Z"
            className="fill-card"
            style={{ filter: 'drop-shadow(0px -4px 10px rgba(0,0,0,0.06))' }}
          />
        </svg>
      </div>

      {/* FAB Central: AI Chat */}
      <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-20">
        <button
          onClick={() => navigate('/cliente/ai-chat')}
          className="group relative w-14 h-14 bg-primary hover:bg-primary-light rounded-full flex items-center justify-center text-white z-20 transition-all active:scale-95 shadow-[0_8px_20px_rgba(9,201,114,0.4)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.6)]"
        >
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          </div>
          <div className="relative z-10 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none flex items-center justify-center pt-0.5">
            <LogoPassagene height={28} showText={false} variant="hollow" />
          </div>
        </button>
      </div>

      {/* Itens de Navegação (2 + espaço + 2) */}
      <div className="relative z-10 flex items-center justify-between h-[88px] px-2 pb-2 pointer-events-auto">
        <div className="flex h-full flex-1">
          {leftRoutes.map((route) => (
            <BarItem key={route} route={route} pathname={location.pathname} />
          ))}
        </div>
        <div className="w-[80px] shrink-0" />
        <div className="flex h-full flex-1">
          {rightRoutes.map((route) => (
            <BarItem key={route} route={route} pathname={location.pathname} />
          ))}
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StandardBottomBar — barra flat Mitose (sem sheet)
// ═══════════════════════════════════════════════════════════════════

function StandardBottomBar() {
  const location = useLocation();
  const { getAccessibleHubs } = usePermissions();
  const [mitosisHubCode, setMitosisHubCode] = useState<string | null>(null);

  // Ref para detectar clique fora e fechar a mitose
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMitosisHubCode(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside); // para mobile tap
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const accessibleHubs = getAccessibleHubs();

  // Hubs reais (filtra hub que só tem "/" e "relatorios", pois foi mesclado com escritorio)
  const realHubs = useMemo(() => {
    return accessibleHubs.filter(h => !(h.routes.length === 1 && h.routes[0] === '/') && h.code !== 'relatorios');
  }, [accessibleHubs]);

  const isSingleHub = realHubs.length === 1;

  // Rotas rápidas para a barra inferior (AGORA APENAS PARA SINGLE-HUB)
  const quickRoutes = useMemo(() => {
    if (!isSingleHub) return null;

    const code = realHubs[0]?.code;
    if (!code) return null;
    return HUB_QUICK_ROUTES[code] || null;
  }, [isSingleHub, realHubs]);

  // Modo: 'hub-routes' (single hub) | 'hub-list' (multi-hub)
  const mode = quickRoutes !== null ? 'hub-routes' : 'hub-list';

  return (
    <>
      <nav ref={navRef} className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom pointer-events-none md:bottom-4 md:px-4">

        {/* Tint overlay do fundo para focar nas bolhas da mitose (aparece apenas quando a mitose abrir) */}
        <div
          className={cn(
            "fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300 z-0 pointer-events-none",
            mitosisHubCode ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Barra flat principal */}
        <div
          className="pointer-events-auto bg-card border-t border-border/40 relative z-10 md:max-w-4xl md:mx-auto md:rounded-2xl md:border md:shadow-2xl transition-all"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-evenly h-16 px-2 md:px-4">


            {mode === 'hub-routes' && quickRoutes ? (
              <>
                {/* Apenas Single Hub: Listamos atalhos úteis dele ao invés de Botões de Mitose */}
                {quickRoutes.slice(0, 4).map((route) => (
                  <BarItem key={route} route={route} pathname={location.pathname} />
                ))}
              </>
            ) : (
              <>
                {/* Multi Hubs: Hub Buttons Expansivos (Mitose) */}
                {realHubs.map((hub) => {
                  const isActive = hub.routes.some((route) => isRouteActive(location.pathname, route));
                  const routes = hub.routes.filter(r => r !== '/');

                  return (
                    <HubButton
                      key={hub.code}
                      hub={hub}
                      isActive={isActive}
                      isOpen={mitosisHubCode === hub.code}
                      routes={routes}
                      onToggle={() =>
                        setMitosisHubCode((prev) => (prev === hub.code ? null : hub.code))
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MobileNav — entry point
// ═══════════════════════════════════════════════════════════════════

export default function MobileNav() {
  const { isCliente } = usePermissions();

  return isCliente ? <ClienteBottomBar /> : <StandardBottomBar />;
}
