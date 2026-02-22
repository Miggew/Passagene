import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  iconBgColor?: string;
  // Comparativo
  comparativo?: {
    valorAnterior: number;
    labelAnterior: string; // ex: "Jan 2025" ou "vs mês anterior"
    delta: number; // diferença em pontos percentuais
    deltaPercent: number; // variação percentual
  };
  // Quando não há dados para comparar
  semComparativo?: {
    mensagem: string; // ex: "Comparativo disponível a partir de Jan 2027"
    fallback?: {
      label: string;
      valor: number;
      delta: number;
    };
  };
  loading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-primary/10',
  comparativo,
  semComparativo,
  loading,
  className,
}: KPICardProps) {
  const formatDelta = (delta: number) => {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)} pp`;
  };

  const formatDeltaPercent = (deltaPercent: number) => {
    const sign = deltaPercent > 0 ? '+' : '';
    return `(${sign}${deltaPercent.toFixed(1)}%)`;
  };

  const getTrendIcon = (delta: number) => {
    if (delta > 0.5) return <TrendingUp className="w-4 h-4" />;
    if (delta < -0.5) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = (delta: number) => {
    if (delta > 0.5) return 'text-emerald-600 dark:text-emerald-400';
    if (delta < -0.5) return 'text-rose-600 dark:text-rose-400';
    return 'text-muted-foreground';
  };

  return (
    <Card className={cn('relative overflow-hidden group', className)}>
      {/* Biological Slow Background Pulse - Custo Zero */}
      <div className="absolute inset-0 bg-primary/5 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none mix-blend-overlay" />
      <CardContent className="pt-4 pb-4 relative z-10">
        <div className="flex items-start gap-3">
          {icon && (
            <div className={cn('p-2 rounded-lg shrink-0', iconBgColor)}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {title}
            </p>

            {loading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {value}
              </p>
            )}

            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}

            {/* Comparativo com ano anterior */}
            {comparativo && !loading && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {comparativo.labelAnterior}: {comparativo.valorAnterior.toFixed(1)}%
                  </span>
                  <div className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor(comparativo.delta))}>
                    {getTrendIcon(comparativo.delta)}
                    <span>{formatDelta(comparativo.delta)}</span>
                    <span className="text-muted-foreground">{formatDeltaPercent(comparativo.deltaPercent)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quando não há comparativo histórico */}
            {semComparativo && !comparativo && !loading && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                      <Info className="w-3 h-3" />
                      <span>Sem histórico ano anterior</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{semComparativo.mensagem}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Fallback: comparar com mês anterior */}
                {semComparativo.fallback && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {semComparativo.fallback.label}: {semComparativo.fallback.valor.toFixed(1)}%
                    </span>
                    <div className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor(semComparativo.fallback.delta))}>
                      {getTrendIcon(semComparativo.fallback.delta)}
                      <span>{formatDelta(semComparativo.fallback.delta)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default KPICard;
