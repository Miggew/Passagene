/**
 * Navegação mobile com barra inferior hub-aware e menu lateral
 */

import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  Menu,
  LogOut,
  Syringe,
  TestTube,
  ArrowRightLeft,
  ThumbsUp,
  Sparkles,
  Shield,
  Snowflake,
  FileBarChart,
  FileText,
  ClipboardList,
  TrendingUp,
  Dna,
  History,
  Beef,
  Container,
  FlaskConical,
  Microscope,
  Brain,
  Building2,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { CowIcon } from '@/components/icons/CowIcon';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ThemeToggle from '@/components/shared/ThemeToggle';
import type { Hub } from '@/lib/types';

// Mapeamento de ícones por rota
const routeIcons: Record<string, React.ElementType> = {
  '/': Home,
  '/administrativo': Shield,
  '/doadoras': DonorCowIcon,
  '/touros': Sparkles,
  '/lotes-fiv': TestTube,
  '/embrioes': EmbryoIcon,
  '/embrioes-congelados': Snowflake,
  '/doses-semen': SpermIcon,
  '/protocolos': Syringe,
  '/aspiracoes': TestTube,
  '/transferencia': ArrowRightLeft,
  '/dg': ThumbsUp,
  '/sexagem': GenderIcon,
  '/relatorios': FileBarChart,
  '/relatorios/servicos': ClipboardList,
  '/relatorios/animais': DonorCowIcon,
  '/relatorios/material': EmbryoIcon,
  '/relatorios/producao': TrendingUp,
  '/genetica': Dna,
  '/genetica/doadoras': DonorCowIcon,
  '/genetica/touros': Sparkles,
  // Rotas do cliente
  '/cliente/rebanho': Beef,
  '/cliente/relatorios': FileBarChart,
  '/cliente/botijao': Container,
  // Hub Laboratório
  '/laboratorio': FlaskConical,
  '/bancada': Microscope,
  '/embryoscore': Brain,
  // Hub Escritório
  '/escritorio': FileText,
  '/escritorio/dg': ThumbsUp,
  '/escritorio/sexagem': GenderIcon,
  '/escritorio/protocolo-p1': Syringe,
  '/escritorio/protocolo-p2': Syringe,
  '/escritorio/te': ArrowRightLeft,
  '/escritorio/aspiracao': TestTube,
  '/escritorio/historico': History,
};

// Labels das rotas
const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/administrativo': 'Admin',
  '/doadoras': 'Doadoras',
  '/touros': 'Touros',
  '/lotes-fiv': 'Lotes FIV',
  '/embrioes': 'Embriões',
  '/embrioes-congelados': 'Congelados',
  '/doses-semen': 'Doses',
  '/protocolos': 'Protocolos',
  '/aspiracoes': 'Aspirações',
  '/transferencia': 'TE',
  '/dg': 'DG',
  '/sexagem': 'Sexagem',
  '/relatorios': 'Relatórios',
  '/relatorios/servicos': 'Serviços',
  '/relatorios/animais': 'Animais',
  '/relatorios/material': 'Material',
  '/relatorios/producao': 'Produção',
  '/genetica': 'Genética',
  '/genetica/doadoras': 'Doadoras',
  '/genetica/touros': 'Touros',
  // Rotas do cliente
  '/cliente/rebanho': 'Rebanho',
  '/cliente/relatorios': 'Relatórios',
  '/cliente/botijao': 'Botijão',
  // Hub Laboratório
  '/laboratorio': 'Laboratório',
  '/bancada': 'Bancada',
  '/embryoscore': 'EmbryoScore',
  // Hub Escritório
  '/escritorio': 'Escritório',
  '/escritorio/dg': 'DG',
  '/escritorio/sexagem': 'Sexagem',
  '/escritorio/protocolo-p1': 'Protocolo P1',
  '/escritorio/protocolo-p2': 'Protocolo P2',
  '/escritorio/te': 'TE',
  '/escritorio/aspiracao': 'Aspiração',
  '/escritorio/historico': 'Histórico',
};

// Rotas rápidas por hub para a barra inferior
const HUB_QUICK_ROUTES: Record<string, string[]> = {
  administrativo: ['/protocolos', '/transferencia', '/dg'],
  laboratorio:    ['/bancada', '/lotes-fiv', '/embryoscore'],
  escritorio:     ['/escritorio/dg', '/escritorio/te', '/escritorio/aspiracao'],
  relatorios:     ['/relatorios/servicos', '/relatorios/animais', '/relatorios/producao'],
  genetica:       ['/genetica/doadoras', '/genetica/touros'],
};

// Ícones dos hubs (mesmos do HubTabs)
const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  laboratorio: FlaskConical,
  escritorio: FileText,
  relatorios: FileBarChart,
  genetica: Dna,
};

// Rotas específicas para clientes (4 itens, sem Menu)
const CLIENTE_NAV_ROUTES = ['/', '/cliente/rebanho', '/cliente/relatorios', '/cliente/botijao'];

/** Determina o hub do bottom bar por prefixo de URL */
function getBottomBarHubCode(pathname: string, fallbackHub: Hub | null): string | null {
  if (pathname.startsWith('/escritorio')) return 'escritorio';
  if (pathname.startsWith('/relatorios')) return 'relatorios';
  if (pathname.startsWith('/genetica')) return 'genetica';
  if (pathname.startsWith('/cliente')) return 'cliente';
  // Rotas do Lab
  if (pathname === '/bancada' || pathname.startsWith('/bancada/')) return 'laboratorio';
  if (pathname === '/embryoscore' || pathname.startsWith('/embryoscore/')) return 'laboratorio';
  if (pathname === '/laboratorio') return 'laboratorio';
  if (pathname === '/lotes-fiv' || pathname.startsWith('/lotes-fiv/')) return 'laboratorio';
  // Home → null (modo hubs)
  if (pathname === '/') return null;
  // Default: use hub do DB ou administrativo
  return fallbackHub?.code ?? 'administrativo';
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCliente, getHubForRoute, getAccessibleHubs } = usePermissions();
  const { signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentHub = getHubForRoute(location.pathname);
  const accessibleHubs = getAccessibleHubs();

  const isRouteActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const bottomBarHubCode = getBottomBarHubCode(location.pathname, currentHub);

  // Rotas rápidas na barra inferior
  const quickRoutes = useMemo(() => {
    if (isCliente) return CLIENTE_NAV_ROUTES;

    if (bottomBarHubCode) {
      const hubRoutes = HUB_QUICK_ROUTES[bottomBarHubCode];
      if (hubRoutes) return ['/', ...hubRoutes];
    }

    // Na Home ou rota sem hub → null sinaliza modo hubs
    return null;
  }, [isCliente, bottomBarHubCode]);

  // Hubs para mostrar na Home (modo hubs)
  const hubSlots = useMemo(() => {
    if (quickRoutes !== null) return [];
    return accessibleHubs
      .filter(h => !(h.routes.length === 1 && h.routes[0] === '/'))
      .slice(0, 3);
  }, [quickRoutes, accessibleHubs]);

  // Hubs ordenados para o Menu Sheet (hub atual primeiro)
  const sortedHubs = useMemo(() => {
    const filtered = accessibleHubs.filter(h => !(h.routes.length === 1 && h.routes[0] === '/'));
    if (!bottomBarHubCode) return filtered;
    const currentIdx = filtered.findIndex(h => h.code === bottomBarHubCode);
    if (currentIdx <= 0) return filtered;
    const reordered = [...filtered];
    const [current] = reordered.splice(currentIdx, 1);
    reordered.unshift(current);
    return reordered;
  }, [accessibleHubs, bottomBarHubCode]);

  return (
    <>
      {/* Barra de navegação inferior - apenas mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-20 px-1">
          {/* Modo rotas (dentro de um hub) */}
          {quickRoutes !== null && quickRoutes.map((route) => {
            const Icon = routeIcons[route] || Home;
            const label = routeLabels[route] || route;
            const isActive = isRouteActive(route);

            return (
              <Link
                key={route}
                to={route}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-2 px-1 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-primary'
                )}
              >
                <Icon className={cn('w-7 h-7 mb-1', isActive && 'text-primary')} />
                <span className="text-xs font-semibold truncate max-w-full">{label}</span>
                {isActive && (
                  <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}

          {/* Modo hubs (na Home) */}
          {quickRoutes === null && (
            <>
              {/* Home button */}
              <Link
                to="/"
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-2 px-1 transition-colors',
                  location.pathname === '/'
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-primary'
                )}
              >
                <Home className={cn('w-7 h-7 mb-1', location.pathname === '/' && 'text-primary')} />
                <span className="text-xs font-semibold">Início</span>
                {location.pathname === '/' && (
                  <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>

              {/* Hub buttons */}
              {hubSlots.map((hub) => {
                const Icon = hubIcons[hub.code] || Building2;
                return (
                  <button
                    key={hub.code}
                    onClick={() => navigate(hub.routes[0])}
                    className="flex flex-col items-center justify-center flex-1 h-full py-2 px-1 transition-colors text-muted-foreground active:text-primary"
                  >
                    <Icon className="w-7 h-7 mb-1" />
                    <span className="text-xs font-semibold truncate max-w-full">{hub.name}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Botão Menu - apenas para não-clientes */}
          {!isCliente && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full py-2 px-1 transition-colors',
                    'text-muted-foreground active:text-primary'
                  )}
                >
                  <Menu className="w-7 h-7 mb-1" />
                  <span className="text-xs font-semibold">Menu</span>
                </button>
              </SheetTrigger>

              <SheetContent side="right" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-left text-xl">Menu</SheetTitle>
                    <ThemeToggle size="default" />
                  </div>
                </SheetHeader>

                <div className="flex-1 overflow-auto">
                  {/* Hubs e suas rotas — hub atual primeiro */}
                  {sortedHubs.map((hub) => {
                    const isCurrentHub = hub.code === bottomBarHubCode;
                    return (
                      <div key={hub.code} className="border-b border-border">
                        <div className={cn(
                          'px-5 py-3',
                          isCurrentHub ? 'bg-primary/5' : 'bg-muted/50'
                        )}>
                          <span className={cn(
                            'text-sm font-bold uppercase tracking-wider',
                            isCurrentHub ? 'text-primary' : 'text-muted-foreground'
                          )}>
                            {hub.name}
                          </span>
                        </div>
                        <div className="py-2">
                          {hub.routes.map((route) => {
                            const Icon = routeIcons[route] || Home;
                            const label = routeLabels[route] || route;
                            const isActive = isRouteActive(route);

                            return (
                              <Link
                                key={route}
                                to={route}
                                onClick={() => setSheetOpen(false)}
                                className={cn(
                                  'flex items-center gap-4 px-5 py-4 transition-colors',
                                  isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground active:bg-muted'
                                )}
                              >
                                <Icon className="w-6 h-6" />
                                <span className="text-base font-medium">{label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Link Home */}
                  <div className="p-3">
                    <Link
                      to="/"
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 rounded-xl transition-colors',
                        isRouteActive('/')
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground active:bg-muted'
                      )}
                    >
                      <Home className="w-6 h-6" />
                      <span className="text-base font-medium">Início</span>
                    </Link>
                  </div>

                </div>

                {/* Sair — fixo no rodapé */}
                <div className="p-3 border-t border-border mt-auto">
                  <button
                    onClick={() => { setSheetOpen(false); signOut(); }}
                    className="flex items-center gap-4 px-5 py-4 rounded-xl w-full text-red-500 active:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-6 h-6" />
                    <span className="text-base font-medium">Sair</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </>
  );
}
