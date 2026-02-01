import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Dna, FlaskConical, LogOut, Moon, Sun, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import logoEscrito from '@/assets/logoescrito.svg';
import { CowIcon } from '@/components/icons/CowIcon';

// Mapeamento de ícones por código do hub
const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  genetica: Dna,
  laboratorio: FlaskConical,
  campo: CowIcon,
  relatorios: FileBarChart,
};

export default function Home() {
  const navigate = useNavigate();
  const { getAccessibleHubs, profile } = usePermissions();
  const { signOut } = useAuth();
  const [isDark, setIsDark] = React.useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const accessibleHubs = getAccessibleHubs();

  const handleHubClick = (hubCode: string, firstRoute: string) => {
    navigate(firstRoute);
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col">
      {/* Header unificado */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 md:px-6 h-16">
          {/* Logo */}
          <img
            src={logoEscrito}
            alt="PassaGene"
            className="h-12 w-auto"
          />

          {/* Área direita: user + dark mode + logout */}
          <div className="flex items-center gap-4">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleDarkMode}
              className="text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {profile && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Olá, <span className="text-foreground font-medium">{profile.nome}</span>
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">
              Selecione um módulo
            </h2>
            <p className="text-muted-foreground">
              Escolha o hub que deseja acessar
            </p>
          </div>

          {accessibleHubs.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-border bg-card shadow-sm p-6">
              <p className="text-muted-foreground">
                Você não tem acesso a nenhum módulo.
              </p>
              <p className="text-muted-foreground/70 text-sm mt-2">
                Entre em contato com o administrador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {accessibleHubs.map((hub) => {
                const Icon = hubIcons[hub.code] || Building2;

                return (
                  <button
                    key={hub.code}
                    onClick={() => handleHubClick(hub.code, hub.routes[0])}
                    className={cn(
                      'flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200',
                      'bg-primary hover:bg-primary-dark text-primary-foreground',
                      'shadow-md hover:shadow-lg',
                      'transform hover:scale-105 active:scale-[0.98]'
                    )}
                  >
                    <Icon className="w-14 h-14 mb-4" />
                    <span className="font-heading text-lg font-semibold">{hub.name}</span>
                    {hub.description && (
                      <span className="text-sm opacity-80 mt-1 text-center">
                        {hub.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-muted-foreground text-sm border-t border-border bg-card">
        PassaGene &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
