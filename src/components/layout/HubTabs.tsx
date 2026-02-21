import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Dna, FileText, FlaskConical, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { CowIcon } from '@/components/icons/CowIcon';
import ThemeToggle from '@/components/shared/ThemeToggle';

// Mapeamento de ícones por código do hub
const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  genetica: Dna,
  laboratorio: FlaskConical,
  escritorio: FileText,
  campo: CowIcon,
};

export default function HubTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCliente, getAccessibleHubs, getHubForRoute, profile } = usePermissions();
  const { signOut } = useAuth();

  // Filtra hubs que só têm "/" como rota (redundante com o logo)
  const accessibleHubs = getAccessibleHubs().filter(
    hub => !(hub.routes.length === 1 && hub.routes[0] === '/')
  );
  const currentHub = getHubForRoute(location.pathname);

  const handleHubClick = (hubCode: string, firstRoute: string) => {
    navigate(firstRoute);
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center justify-between">
        {/* Lado esquerdo: Logo + Tabs */}
        <div className="flex items-center">
          {/* Logo PassaGene Animada - Volta para Home */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center px-4 py-3 hover:bg-muted transition-colors border-r border-border"
            title="PassaGene - Voltar para Home"
          >
            <LogoPassagene height={32} showText={false} variant="premium" />
          </button>

          {/* Tabs dos hubs - esconde para clientes ou se houver apenas 1 hub */}
          {!isCliente && accessibleHubs.length > 1 && (
            <nav className="flex items-center overflow-x-auto">
              {accessibleHubs.map((hub) => {
                const Icon = hubIcons[hub.code] || Building2;
                const isActive = currentHub?.code === hub.code;

                return (
                  <button
                    key={hub.code}
                    onClick={() => handleHubClick(hub.code, hub.routes[0])}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                      isActive
                        ? 'bg-primary/5 text-[hsl(var(--logo-bg))] border-b-[3px] border-[hsl(var(--logo-bg))] font-bold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted border-b-2 border-transparent'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive && 'text-primary')} />
                    <span>{hub.name}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Lado direito: User info + Dark mode + Logout */}
        <div className="flex items-center gap-2 px-4">
          {/* Dark mode toggle */}
          <ThemeToggle size="sm" />

          {/* User info */}
          {profile && (
            <span className="hidden md:inline text-sm text-muted-foreground px-2">
              <span className="text-foreground font-medium">{profile.nome}</span>
            </span>
          )}

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
