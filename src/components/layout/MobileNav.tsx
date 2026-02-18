/**
 * Navegação mobile com barra inferior e menu lateral
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ThemeToggle from '@/components/shared/ThemeToggle';

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
  // Rotas do cliente
  '/cliente/rebanho': Beef,

  '/cliente/relatorios': FileBarChart,
  '/cliente/botijao': Container,
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
  // Rotas do cliente
  '/cliente/rebanho': 'Rebanho',

  '/cliente/relatorios': 'Relatórios',
  '/cliente/botijao': 'Botijão',
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

// Rotas principais para barra inferior (máximo 5)
const QUICK_NAV_ROUTES = ['/', '/protocolos', '/transferencia', '/dg'];

// Rotas específicas para clientes (4 itens, sem Menu)
const CLIENTE_NAV_ROUTES = ['/', '/cliente/rebanho', '/cliente/relatorios', '/cliente/botijao'];

export default function MobileNav() {
  const location = useLocation();
  const { isCliente, getHubForRoute, getAccessibleHubs } = usePermissions();
  const { signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentHub = getHubForRoute(location.pathname);
  const accessibleHubs = getAccessibleHubs();

  const isRouteActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Rotas rápidas na barra inferior - cliente usa rotas específicas
  const quickRoutes = isCliente
    ? CLIENTE_NAV_ROUTES
    : QUICK_NAV_ROUTES.filter(route => {
      // Verifica se o usuário tem acesso
      const hub = getHubForRoute(route);
      return hub !== null;
    });

  return (
    <>
      {/* Barra de navegação inferior - apenas mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-20 px-1">
          {quickRoutes.map((route) => {
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
                  {/* Hubs e suas rotas */}
                  {accessibleHubs
                    .filter(hub => !(hub.routes.length === 1 && hub.routes[0] === '/'))
                    .map((hub) => (
                      <div key={hub.code} className="border-b border-border">
                        <div className="px-5 py-3 bg-muted/50">
                          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
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
                    ))}

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
