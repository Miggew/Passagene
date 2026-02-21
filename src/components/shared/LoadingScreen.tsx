/**
 * Tela de Loading com logo PassaGene
 * Componente reutilizável para carregamento de páginas
 *
 * PADRÃO: Para páginas do hub cliente, usar sem props para centralizar na tela
 */

import { cn } from '@/lib/utils';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

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

const sizeMap = { sm: 48, md: 80, lg: 112 };

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
          : 'min-h-[calc(100dvh-180px)]',
        className
      )}
    >
      <LoaderDNA
        size={sizeMap[size]}
        variant="premium"
      />

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
      <LoaderDNA size={32} variant="premium" />
      <span className="text-sm font-medium text-muted-foreground">{text}</span>
    </div>
  );
}
