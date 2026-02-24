/**
 * Barra de filtros horizontal para o Mercado de Genética
 * Chips de tipo, raça e busca — otimizado para mobile
 */

import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CatalogoDoadora, CatalogoTouro } from '@/hooks/genetica/useCatalogoData';

type TipoFilter = 'todos' | 'doadora' | 'touro';

interface MercadoFiltersProps {
  tipo: TipoFilter;
  onTipoChange: (tipo: TipoFilter) => void;
  raca: string;
  onRacaChange: (raca: string) => void;
  busca: string;
  onBuscaChange: (busca: string) => void;
  doadoras: CatalogoDoadora[];
  touros: CatalogoTouro[];
}

export function MercadoFilters({
  tipo,
  onTipoChange,
  raca,
  onRacaChange,
  busca,
  onBuscaChange,
  doadoras,
  touros,
}: MercadoFiltersProps) {
  // Extrair raças únicas dos dados
  const racas = useMemo(() => {
    const set = new Set<string>();
    for (const d of doadoras) if (d.raca) set.add(d.raca);
    for (const t of touros) if (t.raca) set.add(t.raca);
    return [...set].sort();
  }, [doadoras, touros]);

  const hasActiveFilters = tipo !== 'todos' || raca !== '' || busca !== '';

  return (
    <div className="space-y-3">
      {/* Busca premium */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Search className="w-3.5 h-3.5 text-primary/70" />
        </div>
        <Input
          placeholder="Buscar por nome ou registro..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="pl-11 h-11 text-base rounded-xl border-border/60 glass-panel shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
        />
      </div>

      {/* Chips de tipo */}
      <div className="flex gap-2">
        {(['todos', 'doadora', 'touro'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTipoChange(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tipo === t
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            )}
          >
            {t === 'todos' ? 'Todos' : t === 'doadora' ? 'Doadoras' : 'Touros'}
          </button>
        ))}

        {hasActiveFilters && (
          <button
            onClick={() => {
              onTipoChange('todos');
              onRacaChange('');
              onBuscaChange('');
            }}
            className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Chips de raça (scroll horizontal) */}
      {racas.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => onRacaChange('')}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              raca === ''
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
            )}
          >
            Todas raças
          </button>
          {racas.map((r) => (
            <button
              key={r}
              onClick={() => onRacaChange(raca === r ? '' : r)}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                raca === r
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
