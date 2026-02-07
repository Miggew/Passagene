/**
 * Card mobile-friendly para exibir doadora
 * Design premium com estatísticas visuais
 * Refatorado com sistema de badges padronizado
 */

import { Hash, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import CountBadge from '@/components/shared/CountBadge';

interface DoadoraCardProps {
  data: {
    id: string;
    nome?: string;
    registro?: string;
    raca?: string;
    media_oocitos?: number;
    total_aspiracoes?: number;
  };
  onClick?: () => void;
}

export function DoadoraCard({ data, onClick }: DoadoraCardProps) {
  const hasStats = data.total_aspiracoes && data.total_aspiracoes > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 active:scale-[0.98] shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Ícone */}
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/15 flex items-center justify-center shrink-0">
          <DonorCowIcon className="w-5 h-5 text-amber-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">
            {data.nome || data.registro || 'Sem nome'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {data.registro && data.nome && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3 opacity-60" />
                {data.registro}
              </span>
            )}
            {data.raca && (
              <span className="text-xs text-muted-foreground/70 truncate">
                {data.raca}
              </span>
            )}
          </div>
        </div>

        {/* Stats inline com CountBadge - Premium */}
        <div className="flex items-center gap-2.5 shrink-0">
          {hasStats && (
            <div className="flex items-center gap-2.5">
              {/* Aspirações */}
              <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-muted/40">
                <span className="text-lg font-bold text-foreground">{data.total_aspiracoes}</span>
                <span className="text-xs text-muted-foreground font-medium">aspirações</span>
              </div>
              {/* Média de oócitos */}
              {data.media_oocitos !== undefined && (
                <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15">
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{Math.round(data.media_oocitos)}</span>
                  <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">média</span>
                </div>
              )}
            </div>
          )}
          {onClick && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}
