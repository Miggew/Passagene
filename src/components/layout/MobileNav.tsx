/**
 * Navegação mobile com barra inferior e menu lateral
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Home,
  Menu,
  X,
  Syringe,
  TestTube,
  ArrowRightLeft,
  ThumbsUp,
  Sparkles,
  Shield,
  Snowflake,
  FileBarChart,
  ClipboardList,
  TrendingUp,
  Dna,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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
};

// Rotas principais para barra inferior (máximo 5)
const QUICK_NAV_ROUTES = ['/', '/protocolos', '/transferencia', '/dg'];

export default function MobileNav() {
  const location = useLocation();
  const { getHubForRoute, getAccessibleHubs } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentHub = getHubForRoute(location.pathname);
  const accessibleHubs = getAccessibleHubs();

  const isRouteActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Rotas rápidas na barra inferior
  const quickRoutes = QUICK_NAV_ROUTES.filter(route => {
    // Verifica se o usuário tem acesso
    const hub = getHubForRoute(route);
    return hub !== null;
  });

  return (
    <>
      {/* Barra de navegação inferior - apenas mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {quickRoutes.map((route) => {
            const Icon = routeIcons[route] || Home;
            const label = routeLabels[route] || route;
            const isActive = isRouteActive(route);

            return (
              <Link
                key={route}
                to={route}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-primary'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'text-primary')} />
                <span className="text-[10px] font-medium truncate max-w-full">{label}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}

          {/* Botão Menu */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-colors',
                  'text-muted-foreground active:text-primary'
                )}
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">Menu</span>
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-auto">
                {/* Hubs e suas rotas */}
                {accessibleHubs
                  .filter(hub => !(hub.routes.length === 1 && hub.routes[0] === '/'))
                  .map((hub) => (
                    <div key={hub.code} className="border-b border-border">
                      <div className="px-4 py-2 bg-muted/50">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {hub.name}
                        </span>
                      </div>
                      <div className="py-1">
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
                                'flex items-center gap-3 px-4 py-3 transition-colors',
                                isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-foreground active:bg-muted'
                              )}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-sm">{label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                {/* Link Home */}
                <div className="p-2">
                  <Link
                    to="/"
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isRouteActive('/')
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground active:bg-muted'
                    )}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-sm">Início</span>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Espaçador para não sobrepor o conteúdo */}
      <div className="md:hidden h-16" />
    </>
  );
}
