/**
 * Card mobile-friendly para exibir touro com doses de sêmen
 * Design premium com destaque para quantidade
 * Refatorado com sistema de badges padronizado
 */

import { Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpermIcon } from '@/components/icons/SpermIcon';
import CountBadge from '@/components/shared/CountBadge';

interface TouroCardProps {
  data: {
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
    totalDoses: number;
    tipos?: string[];
  };
  onClick?: () => void;
}

export function TouroCard({ data, onClick }: TouroCardProps) {
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
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/15 flex items-center justify-center shrink-0">
          <SpermIcon className="w-5 h-5 text-indigo-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">
            {data.nome || 'Sem nome'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {data.registro && (
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

        {/* Quantidade com CountBadge - Premium */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Container de doses destacado */}
          <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{data.totalDoses}</span>
            <span className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-medium">doses</span>
          </div>
          {/* Tipos com badges */}
          {data.tipos && data.tipos.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {data.tipos.slice(0, 2).map((tipo, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
                  {tipo}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
