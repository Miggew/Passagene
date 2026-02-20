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
      {/* Logo com animação 3D DNA Helix */}
      <div className={cn('relative flex items-center justify-center', sizeMap[size])}>
        {/* Core pulsing glow */}
        <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse blur-md" />

        {/* Logo Container com Dupla Hélice Diagonal Central */}
        <div className="relative w-full h-full bg-primary rounded-2xl shadow-[0_10px_40px_rgba(9,201,114,0.3)] flex items-center justify-center overflow-hidden">
          <div className="flex items-center justify-center h-[40%] -rotate-45 scale-[1.4]">
            <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.4s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.4s" }} /></div>
            <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.25s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.25s" }} /></div>
            <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.1s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.1s" }} /></div>
            <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-0.95s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-0.95s" }} /></div>
            <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-0.8s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-0.8s" }} /></div>
          </div>
        </div>
      </div>

      {/* Texto opcional */}
      {text && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-sm font-medium text-primary tracking-wide animate-pulse">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Versão inline menor para uso em seções
 */
export function LoadingInline({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-4 py-8">
      {/* Mini Hélice Diagonal Vazada */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary -rotate-45 scale-[0.9] shadow-sm">
        <div className="flex items-center justify-center h-4">
          <div className="relative w-1 h-full mx-px"><div className="absolute w-1 h-1 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.4s" }} /><div className="absolute w-1 h-1 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.4s" }} /></div>
          <div className="relative w-1 h-full mx-px"><div className="absolute w-1 h-1 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.25s" }} /><div className="absolute w-1 h-1 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.25s" }} /></div>
          <div className="relative w-1 h-full mx-px"><div className="absolute w-1 h-1 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.1s" }} /><div className="absolute w-1 h-1 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.1s" }} /></div>
          <div className="relative w-1 h-full mx-px"><div className="absolute w-1 h-1 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-0.95s" }} /><div className="absolute w-1 h-1 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-0.95s" }} /></div>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{text}</span>
    </div>
  );
}
