/**
 * Card mobile-friendly para exibir embriões agrupados
 * Design premium com destaque para contagem
 * Refatorado com sistema de badges padronizado
 */

import { Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import CountBadge from '@/components/shared/CountBadge';

interface EmbrioCardProps {
  data: {
    id: string;
    nome: string;
    registro?: string;
    count: number;
  };
  tipo: 'doadora' | 'touro';
  onClick?: () => void;
}

export function EmbrioCard({ data, tipo, onClick }: EmbrioCardProps) {
  const Icon = tipo === 'doadora' ? DonorCowIcon : SpermIcon;
  const isDoadora = tipo === 'doadora';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 active:scale-[0.98] shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md hover:border-cyan-500/30'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Ícone */}
        <div className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border',
          isDoadora
            ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/15'
            : 'bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border-indigo-500/15'
        )}>
          <Icon className={cn('w-5 h-5', isDoadora ? 'text-amber-500' : 'text-indigo-500')} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">
            {data.nome || 'Sem nome'}
          </p>
          {data.registro && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {data.registro}
            </p>
          )}
        </div>

        {/* Contagem com ícone - Premium */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15">
            <div className="flex items-center gap-1.5">
              <Snowflake className="w-4 h-4 text-cyan-500" />
              <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{data.count}</span>
            </div>
            <span className="text-xs text-cyan-600/70 dark:text-cyan-400/70 font-medium">embriões</span>
          </div>
        </div>
      </div>
    </div>
  );
}
