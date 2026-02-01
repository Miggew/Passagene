import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type CountBadgeVariant =
  | 'default'    // Neutro (cinza) - totais
  | 'primary'    // Verde primário - destaque positivo
  | 'success'    // Verde - prenhes, aptas
  | 'warning'    // Âmbar - atenção, retoques
  | 'danger'     // Vermelho - vazias, inaptas
  | 'info'       // Azul - informativo
  | 'pink'       // Rosa - fêmeas
  | 'blue'       // Azul - machos
  | 'purple'     // Roxo - sem sexo
  | 'cyan'       // Ciano - congelados
  | 'violet';    // Violeta - transferidos/servidas

interface CountBadgeProps {
  value: number | string;
  variant?: CountBadgeVariant;
  suffix?: string;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Sistema de cores para badges de contagem
 * Padrão premium: bg-[cor]/15 text-[cor]-600 dark:text-[cor]-400
 */
const variantClasses: Record<CountBadgeVariant, string> = {
  default: 'bg-muted text-foreground',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-green-500/15 text-green-600 dark:text-green-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  pink: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  cyan: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

/**
 * CountBadge - Badge para exibição de contagens numéricas
 *
 * @example
 * <CountBadge value={42} />
 * <CountBadge value={85} variant="success" suffix="%" />
 * <CountBadge value={stats.prenhes} variant="success" />
 * <CountBadge value={stats.vazias} variant="danger" />
 */
export default function CountBadge({
  value,
  variant = 'default',
  suffix = '',
  className,
  size = 'default',
}: CountBadgeProps) {
  const colorClasses = variantClasses[variant];

  const sizeClasses = size === 'sm'
    ? 'min-w-5 h-4 px-1 text-[10px]'
    : 'min-w-6 h-5 px-1.5 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md',
        colorClasses,
        sizeClasses,
        className
      )}
    >
      {value}{suffix}
    </span>
  );
}

/**
 * Utilitário para determinar variante de taxa baseado no valor
 */
export function getTaxaVariant(taxa: number, threshold = 50): CountBadgeVariant {
  return taxa >= threshold ? 'primary' : 'warning';
}
