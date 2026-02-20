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
import { Plus, Activity, Droplet, X } from 'lucide-react';
import type { Hub } from '@/lib/types';
import LogoSimples from '@/assets/logosimples.svg';

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
  laboratorio: ['/bancada', '/lotes-fiv', '/embryoscore'],
  escritorio: ['/escritorio/dg', '/escritorio/te', '/escritorio/aspiracao'],
  relatorios: ['/relatorios/servicos', '/relatorios/animais', '/relatorios/producao'],
  genetica: ['/genetica/doadoras', '/genetica/touros'],
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
  const [mitosisOpen, setMitosisOpen] = useState(false);

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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-transparent safe-area-bottom pointer-events-none">

        {/* Curva Orgânica - SVG Background em toda a extensão */}
        {/* Usamos filter drop-shadow no lugar do border-t rígido */}
        <div className="absolute bottom-0 w-full h-[88px] pointer-events-auto">
          <svg
            className="absolute bottom-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 375 88"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M0 88V16H115.5C125 16 137.5 16 148 29.5C158.5 43 168.5 56 187.5 56C206.5 56 216.5 43 227 29.5C237.5 16 250 16 259.5 16H375V88H0Z"
              className="fill-card"
              style={{ filter: "drop-shadow(0px -4px 10px rgba(0,0,0,0.06))" }}
            />
          </svg>
        </div>

        {/* FAB Nucleo Central: Botão do Geno (AI Chat) */}
        <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 flex items-end justify-center pointer-events-auto z-20">
          <button
            onClick={() => {
              setMitosisOpen(false); // just in case
              navigate('/cliente/ai-chat');
            }}
            className="group relative w-14 h-14 bg-primary hover:bg-primary-light rounded-full flex items-center justify-center text-white z-20 transition-all active:scale-95 shadow-[0_8px_20px_rgba(9,201,114,0.4)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.6)]"
          >
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
            </div>
            <img src={LogoSimples} alt="Geno A.I." className="w-7 h-7 relative z-10 animate-pulse group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] brightness-0 invert" />
          </button>
        </div>

        {/* Content Overlay (Itens de Navegação) */}
        <div className="relative z-10 flex items-center justify-between h-[88px] px-2 pb-2 pointer-events-auto">

          {/* Lado Esquerdo */}
          <div className="flex h-full flex-1">
            {quickRoutes !== null && quickRoutes.slice(0, 2).map((route) => {
              const Icon = routeIcons[route] || Home;
              const label = routeLabels[route] || route;
              const isActive = isRouteActive(route);

              return (
                <Link
                  key={route}
                  to={route}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon className={cn('w-6 h-6 mb-1 transition-transform', isActive && 'scale-110')} />
                  <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{label}</span>
                  {isActive && <div className="absolute bottom-2 w-1 h-1 rounded-full bg-primary" />}
                </Link>
              );
            })}

            {/* Hub Modes Left */}
            {quickRoutes === null && (
              <>
                <Link
                  to="/"
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all',
                    location.pathname === '/' ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Home className={cn('w-6 h-6 mb-1 transition-transform', location.pathname === '/' && 'scale-110')} />
                  <span className="text-[10px] font-bold tracking-tight">Início</span>
                  {location.pathname === '/' && <div className="absolute bottom-2 w-1 h-1 rounded-full bg-primary" />}
                </Link>
                {hubSlots[0] && (
                  <button
                    onClick={() => navigate(hubSlots[0].routes[0])}
                    className="flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all text-muted-foreground"
                  >
                    {(() => { const Icon = hubIcons[hubSlots[0].code] || Building2; return <Icon className="w-6 h-6 mb-1" />; })()}
                    <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{hubSlots[0].name}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Espaço Vazio Central (onde o FAB se encaixa) */}
          <div className="w-[80px] shrink-0" />

          {/* Lado Direito */}
          <div className="flex h-full flex-1">
            {quickRoutes !== null && quickRoutes.slice(2, 4).map((route) => {
              const Icon = routeIcons[route] || Home;
              const label = routeLabels[route] || route;
              const isActive = isRouteActive(route);

              return (
                <Link
                  key={route}
                  to={route}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon className={cn('w-6 h-6 mb-1 transition-transform', isActive && 'scale-110')} />
                  <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{label}</span>
                  {isActive && <div className="absolute bottom-2 w-1 h-1 rounded-full bg-primary" />}
                </Link>
              );
            })}

            {/* Hub Modes Right */}
            {quickRoutes === null && (
              <>
                {hubSlots[1] && (
                  <button
                    onClick={() => navigate(hubSlots[1].routes[0])}
                    className="flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all text-muted-foreground"
                  >
                    {(() => { const Icon = hubIcons[hubSlots[1].code] || Building2; return <Icon className="w-6 h-6 mb-1" />; })()}
                    <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{hubSlots[1].name}</span>
                  </button>
                )}
                {hubSlots[2] && (
                  <button
                    onClick={() => navigate(hubSlots[2].routes[0])}
                    className="flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all text-muted-foreground"
                  >
                    {(() => { const Icon = hubIcons[hubSlots[2].code] || Building2; return <Icon className="w-6 h-6 mb-1" />; })()}
                    <span className="text-[10px] font-bold tracking-tight truncate max-w-[90%]">{hubSlots[2].name}</span>
                  </button>
                )}
              </>
            )}

            {/* Botão Menu (Sheet) */}
            {!isCliente && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <button
                    className="flex flex-col items-center justify-center flex-1 h-full py-2 hover:bg-primary/5 rounded-2xl mx-1 transition-all text-muted-foreground"
                  >
                    <Menu className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold tracking-tight">Menu</span>
                  </button>
                </SheetTrigger>

                {/* Mantém o código do Sheet original inalterado */}
                <SheetContent side="right" className="w-80 p-0 flex flex-col rounded-l-[1.5rem] overflow-hidden border-l-0 shadow-2xl">
                  <SheetHeader className="p-6 border-b border-border bg-card/50 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="text-left text-xl font-extrabold text-primary-800 dark:text-primary-100">PassaGene Menu</SheetTitle>
                      <ThemeToggle size="default" />
                    </div>
                  </SheetHeader>

                  <div className="flex-1 overflow-auto p-2">
                    {/* Hubs e suas rotas — hub atual primeiro */}
                    {sortedHubs.map((hub) => {
                      const isCurrentHub = hub.code === bottomBarHubCode;
                      return (
                        <div key={hub.code} className="mb-4">
                          <div className={cn(
                            'px-4 py-2 mx-2 rounded-lg font-extrabold uppercase text-[11px] tracking-wider mb-1',
                            isCurrentHub ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                          )}>
                            {hub.name}
                          </div>
                          <div className="space-y-1">
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
                                    'flex items-center gap-4 px-4 py-3 mx-2 rounded-xl transition-all',
                                    isActive
                                      ? 'bg-primary/10 text-primary font-bold shadow-sm'
                                      : 'text-foreground hover:bg-muted font-medium'
                                  )}
                                >
                                  <Icon className="w-5 h-5" />
                                  <span className="text-sm">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Link Home */}
                    <div className="mt-8 border-t border-border pt-4">
                      <Link
                        to="/"
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 mx-2 rounded-xl transition-all',
                          isRouteActive('/')
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-foreground hover:bg-muted font-medium'
                        )}
                      >
                        <Home className="w-5 h-5" />
                        <span className="text-sm">Início</span>
                      </Link>
                    </div>

                  </div>

                  {/* Sair — fixo no rodapé */}
                  <div className="p-4 border-t border-border bg-card/50 backdrop-blur-md mt-auto">
                    <button
                      onClick={() => { setSheetOpen(false); signOut(); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-500 hover:bg-red-500/10 transition-all font-bold"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm">Encerrar Sessão</span>
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
