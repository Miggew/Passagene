import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSimples from '@/assets/logosimples.svg';
import logoEscrito from '@/assets/logoescrito.svg';

interface HeaderProps {
  showUserInfo?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showUserInfo = false }) => {
  const { signOut } = useAuth();
  const { profile } = usePermissions();
  const [isDark, setIsDark] = React.useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card/80 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="flex h-[72px] items-center justify-between px-6 lg:px-8">
        {/* Logo - Link para home */}
        <Link to="/" className="flex items-center gap-2">
          {/* Logo responsiva: simples em mobile, escrito em desktop */}
          <img
            src={logoSimples}
            alt="PassaGene"
            className="h-10 w-auto block md:hidden"
          />
          <img
            src={logoEscrito}
            alt="PassaGene"
            className="h-12 w-auto hidden md:block"
          />
        </Link>

        {/* Área direita: dark mode toggle + user info */}
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleDarkMode}
            className="text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors"
            aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User info e logout (opcional) */}
          {showUserInfo && profile && (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{profile.nome}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors ml-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Sair</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
