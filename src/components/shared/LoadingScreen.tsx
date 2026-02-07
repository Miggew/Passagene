/**
 * Tela de Loading com logo PassaGene
 * Componente reutilizável para carregamento de páginas
 *
 * PADRÃO: Para páginas do hub cliente, usar sem props para centralizar na tela
 */

import { cn } from '@/lib/utils';
import LogoSimples from '@/assets/logosimples.svg';

interface LoadingScreenProps {
  /** Texto opcional abaixo da logo */
  text?: string;
  /** Tamanho da logo */
  size?: 'sm' | 'md' | 'lg';
  /** Se deve ocupar a tela toda (fixed) */
  fullScreen?: boolean;
  /** Classe adicional */
  className?: string;
}

const sizeMap = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

export default function LoadingScreen({
  text,
  size = 'lg',
  fullScreen = false,
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullScreen
          ? 'fixed inset-0 bg-background/95 backdrop-blur-sm z-50'
          : 'min-h-[calc(100dvh-180px)]', // Altura padrão para centralizar na área visível
        className
      )}
    >
      {/* Logo com animação de pulso */}
      <div className="relative">
        {/* Círculo de fundo com pulso */}
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />

        {/* Logo */}
        <div className={cn(
          'relative rounded-full bg-card border border-border/50 shadow-lg p-4 flex items-center justify-center',
          'animate-pulse',
          sizeMap[size]
        )}
        style={{ animationDuration: '1.5s' }}
        >
          <img
            src={LogoSimples}
            alt="PassaGene"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Texto opcional */}
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Versão inline menor para uso em seções
 */
export function LoadingInline({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      <div className="w-8 h-8 rounded-full bg-card border border-border/50 shadow p-1.5 animate-pulse">
        <img
          src={LogoSimples}
          alt="PassaGene"
          className="w-full h-full object-contain"
        />
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}
