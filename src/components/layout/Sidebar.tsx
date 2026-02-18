import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Home,
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
  Brain,
  FlaskConical,
  Microscope,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';

// Mapeamento de ícones por rota
const routeIcons: Record<string, React.ElementType> = {
  '/administrativo': Shield,
  '/embryoscore': Brain,
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
  // Hub Relatórios
  '/relatorios': FileBarChart,
  '/relatorios/servicos': ClipboardList,
  '/relatorios/animais': DonorCowIcon,
  '/relatorios/material': EmbryoIcon,
  '/relatorios/producao': TrendingUp,
  '/laboratorio': FlaskConical,
  '/bancada': Microscope,
};

// Labels das rotas
const routeLabels: Record<string, string> = {
  '/administrativo': 'Painel Admin',
  '/embryoscore': 'EmbryoScore IA',
  '/bancada': 'Bancada',
  '/doadoras': 'Doadoras',
  '/touros': 'Catálogo de Touros',
  '/lotes-fiv': 'Lotes FIV',
  '/embrioes': 'Embriões',
  '/embrioes-congelados': 'Embriões Congelados',
  '/doses-semen': 'Doses de Sêmen',
  '/protocolos': 'Protocolos',
  '/aspiracoes': 'Aspirações',
  '/transferencia': 'Transferência (TE)',
  '/dg': 'Diagnóstico Gestação',
  '/sexagem': 'Sexagem',
  // Hub Relatórios
  '/relatorios': 'Visão Geral',
  '/relatorios/servicos': 'Serviços de Campo',
  '/relatorios/animais': 'Animais',
  '/relatorios/material': 'Material Genético',
  '/relatorios/producao': 'Produção',
  '/laboratorio': 'Visão Geral',
};

export default function Sidebar() {
  const location = useLocation();
  const { isCliente, getHubForRoute } = usePermissions();

  // Encontra o hub atual baseado na rota
  const currentHub = getHubForRoute(location.pathname);

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
    <aside className="hidden md:flex w-64 bg-card border-r border-border min-h-full flex-col">
      {/* Header do hub atual */}
      <div className="p-4 border-b border-border">
        <h2 className="font-heading text-lg font-semibold text-foreground">{currentHub.name}</h2>
        {currentHub.description && (
          <p className="text-xs text-muted-foreground mt-1">{currentHub.description}</p>
        )}
      </div>

      {/* Menu de navegação do hub */}
      <nav className="flex-1 p-3 space-y-1">
        {(() => {
          const routes = [...currentHub.routes];
          // HACK: Force add Bancada to Admin/Lab hubs if not present
          if (
            (currentHub.code === 'administrativo' || currentHub.code === 'laboratorio') &&
            !routes.includes('/bancada')
          ) {
            routes.push('/bancada');
          }

          return routes.map((route) => {
            const Icon = routeIcons[route] || Home;
            const label = routeLabels[route] || route;
            const isActive = isRouteActive(route);

            return (
              <Link
                key={route}
                to={route}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px pl-[11px]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : '')} />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })
        })()}
      </nav>
    </aside>
  );
}
