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

// ─── Hub Button (Mitosis mode React State) ──────────────────────────────
function HubButton({ hub, isActive, routes, side = 'left' }: { hub: Hub, isActive: boolean, routes: string[], side?: 'left' | 'right' }) {
  const { pathname } = useLocation();
  const Icon = hubIcons[hub.code] || Home;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar ao mudar de rota
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <>
      {/* Backdrop invisível para capturar clicks mais eficientemente e destacar os botões */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        ref={menuRef}
        className="relative flex-[1.2] flex flex-col items-center justify-end h-[60px] mx-0.5 pb-2 z-50"
      >

        {/* Células Filhas (Mitose para CIMA no MobileNav) */}
        <div className={cn(
          "absolute bottom-[70px] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-4 transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}>
          {routes.map((route, i) => {
            const RouteIcon = routeIcons[route] || Home;
            const label = route === '/relatorios' ? 'Relatórios' : (routeLabels[route] || route);
            const isRouteActivenow = isRouteActive(pathname, route);

            const translateClass = isOpen ? "translate-y-0 scale-100" : (i === 0 ? "translate-y-[20px] scale-50" : i === 1 ? "translate-y-[40px] scale-50" : i === 2 ? "translate-y-[60px] scale-50" : "translate-y-[80px] scale-50");
            const delayClass = isOpen ? (i === 0 ? "delay-[50ms]" : i === 1 ? "delay-[100ms]" : i === 2 ? "delay-[150ms]" : "delay-[200ms]") : "";

            return (
              <Link
                key={route}
                to={route}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "relative flex items-center justify-center transition-all duration-300 ease-out",
                  translateClass,
                  delayClass
                )}
              >
                {/* Etiqueta de Texto Neon Externa (Flutuando ao lado do ícone) */}
                <span className={cn(
                  "absolute px-3 py-1.5 rounded-xl bg-card border border-border text-foreground font-bold text-[12px] whitespace-nowrap shadow-xl",
                  side === 'left' ? "left-14" : "right-14"
                )}>
                  {label}
                </span>

                {/* O Círculo Geométrico da Célula Filha */}
                <div className={cn(
                  "w-12 h-12 rounded-full shadow-lg flex items-center justify-center border-2 transition-all duration-300 active:scale-95",
                  isRouteActivenow ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(9,201,114,0.4)]" : "bg-card border-border text-foreground hover:border-primary/50"
                )}>
                  <RouteIcon className={cn("w-5 h-5", isRouteActivenow && "scale-110")} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Célula Mãe (A Engrenagem de Click) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative flex flex-col items-center justify-center w-12 h-12 rounded-full shadow-md transition-all duration-300 active:scale-95",
            isOpen ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(9,201,114,0.4)] ring-4 ring-primary/20 border-transparent" : "bg-card border border-border border-b-4",
            isActive && !isOpen ? "text-primary border-primary/50 ring-2 ring-primary/20 ring-offset-2 ring-offset-background" : !isOpen ? "text-muted-foreground" : ""
          )}
        >
          <Icon className={cn(
            'w-5 h-5 transition-transform duration-300',
            isOpen ? 'scale-110' : ''
          )} />
        </button>
        <span className={cn(
          "absolute -bottom-4 text-[10px] font-bold tracking-tight truncate max-w-[100%] transition-opacity duration-300 mt-1",
          isActive || isOpen ? "text-primary opacity-100" : "text-muted-foreground opacity-80"
        )}>
          {hub.name}
        </span>
      </div>
    </>
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
          onClick={() => navigate('/genia')}
          className="group relative w-16 h-16 bg-primary hover:bg-primary-light rounded-full flex items-center justify-center text-white z-20 transition-all active:scale-95 shadow-[0_8px_20px_rgba(9,201,114,0.4)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.6)]"
        >
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          </div>
          <div className="relative z-10 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none flex items-center justify-center pt-0.5">
            <LogoPassagene height={36} showText={false} variant="white" forceAnimate={true} />
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
  const navigate = useNavigate();
  const { getAccessibleHubs } = usePermissions();

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
      <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom pointer-events-none md:bottom-4 md:px-4">

        {/* Barra flat principal */}
        <div
          className="pointer-events-auto bg-card border-t border-border/40 relative z-10 md:max-w-4xl md:mx-auto md:rounded-2xl md:border md:shadow-2xl transition-all"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.04)' }}
        >
          {/* FAB Central Global: Consultor IA */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-50">
            <button
              onClick={() => navigate('/genia')}
              className="group relative w-14 h-14 bg-primary hover:bg-primary-light rounded-full flex items-center justify-center text-white z-20 transition-all active:scale-95 shadow-[0_4px_15px_rgba(9,201,114,0.4)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.6)] border-[3px] border-card md:w-16 md:h-16 md:-top-8"
              title="Gen.IA"
            >
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </div>
              <div className="relative z-10 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none flex items-center justify-center pt-0.5">
                <LogoPassagene height={32} showText={false} variant="white" forceAnimate={true} />
              </div>
            </button>
          </div>

          <div className="flex items-center justify-evenly h-16 px-2 md:px-4">


            {mode === 'hub-routes' && quickRoutes ? (
              <>
                {/* Apenas Single Hub: Listamos atalhos úteis dele ao invés de Botões de Mitose */}
                <div className="flex h-full flex-1 justify-evenly">
                  {quickRoutes.slice(0, 2).map((route) => (
                    <BarItem key={route} route={route} pathname={location.pathname} />
                  ))}
                </div>
                <div className="w-[60px] md:w-[70px] shrink-0" /> {/* Espaço para o FAB IA Central */}
                <div className="flex h-full flex-1 justify-evenly">
                  {quickRoutes.slice(2, 4).map((route) => (
                    <BarItem key={route} route={route} pathname={location.pathname} />
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Multi Hubs: Hub Buttons Expansivos (Mitose) */}
                <div className="flex h-full flex-1 justify-evenly">
                  {realHubs.slice(0, Math.ceil(realHubs.length / 2)).map((hub) => {
                    const isActive = hub.routes.some((route) => isRouteActive(location.pathname, route));
                    const routes = hub.routes.filter(r => r !== '/');
                    return <HubButton key={hub.code} hub={hub} isActive={isActive} routes={routes} side="left" />;
                  })}
                </div>

                <div className="w-[60px] md:w-[70px] shrink-0" /> {/* Espaço para o FAB IA Central */}

                <div className="flex h-full flex-1 justify-evenly">
                  {realHubs.slice(Math.ceil(realHubs.length / 2)).map((hub) => {
                    const isActive = hub.routes.some((route) => isRouteActive(location.pathname, route));
                    const routes = hub.routes.filter(r => r !== '/');
                    return <HubButton key={hub.code} hub={hub} isActive={isActive} routes={routes} side="right" />;
                  })}
                </div>
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
