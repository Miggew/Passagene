/**
 * Botão de toggle para alternar entre light/dark mode
 * Design premium com animação suave
 */

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'default';
}

export default function ThemeToggle({ className, size = 'default' }: ThemeToggleProps) {
  const { toggleTheme, isDark } = useTheme();

  const sizeClasses = size === 'sm'
    ? 'w-8 h-8'
    : 'w-10 h-10';

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative rounded-lg flex items-center justify-center transition-all duration-300',
        'bg-muted/50 hover:bg-muted border border-border/50 hover:border-border',
        'active:scale-95',
        sizeClasses,
        className
      )}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {/* Sol - aparece no dark mode */}
      <Sun
        className={cn(
          iconSize,
          'absolute transition-all duration-300',
          isDark
            ? 'rotate-0 scale-100 text-foreground'
            : 'rotate-90 scale-0 text-foreground'
        )}
      />
      {/* Lua - aparece no light mode */}
      <Moon
        className={cn(
          iconSize,
          'absolute transition-all duration-300',
          isDark
            ? '-rotate-90 scale-0 text-foreground'
            : 'rotate-0 scale-100 text-muted-foreground'
        )}
      />
    </button>
  );
}
