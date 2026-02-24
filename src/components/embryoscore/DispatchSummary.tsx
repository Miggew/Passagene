/**
 * DispatchSummary — Resumo final quando todos os embriões estão classificados.
 *
 * Mostra: contagem por classe, concordância biólogo × IA, maturidade do atlas,
 * e botão "Confirmar despacho".
 */

import type { EmbryoScore } from '@/lib/types';
import { Check, Brain, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/mobile-atoms';

const CLASS_COLORS: Record<string, string> = {
  BE: 'bg-primary',
  BN: 'bg-primary/80',
  BX: 'bg-amber-500',
  BL: 'bg-blue-500',
  BI: 'bg-sky-400',
  Mo: 'bg-purple-500',
  Dg: 'bg-destructive',
};

interface DispatchSummaryProps {
  scores: EmbryoScore[];
  atlasTotal?: number;
  atlasBovineReal?: number;
  onConfirmDispatch: () => void;
  isLoading?: boolean;
}

export function DispatchSummary({
  scores,
  atlasTotal = 0,
  atlasBovineReal = 0,
  onConfirmDispatch,
  isLoading,
}: DispatchSummaryProps) {
  // Count by class
  const classCounts: Record<string, number> = {};
  let totalClassified = 0;
  let agreed = 0;

  for (const s of scores) {
    const cls = s.biologist_classification;
    if (!cls) continue;
    classCounts[cls] = (classCounts[cls] || 0) + 1;
    totalClassified++;

    // Check concordance (biologist vs AI suggestion)
    if (s.combined_classification && s.biologist_classification === s.combined_classification) {
      agreed++;
    }
  }

  const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const concordancePercent = totalClassified > 0
    ? Math.round((agreed / totalClassified) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold tracking-tight text-foreground">Resumo do Despacho</h3>
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground opacity-70">
              {totalClassified} embriões validados
            </p>
          </div>
        </div>
        
        <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold uppercase tracking-widest">
          Consenso: {concordancePercent}%
        </div>
      </div>

      {/* Class distribution */}
      <div className="grid grid-cols-1 gap-3">
        {sortedClasses.map(([cls, count]) => {
          const pct = Math.round((count / totalClassified) * 100);
          return (
            <div key={cls} className="flex items-center gap-4">
              <span className="font-display font-black text-xs w-6 text-foreground text-center">{cls}</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden border border-border/30">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${CLASS_COLORS[cls] || 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-muted-foreground w-12 text-right tracking-tighter">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>

      {/* Atlas maturity */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
        <Brain className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Maturidade da IA</p>
          <p className="text-[11px] font-sans text-foreground mt-0.5">
            <b>{atlasTotal.toLocaleString()}</b> referências no atlas (<b>{atlasBovineReal.toLocaleString()}</b> bovinas reais)
          </p>
        </div>
      </div>

      {/* Confirm dispatch */}
      <Button
        onClick={onConfirmDispatch}
        loading={isLoading}
        fullWidth
        size="lg"
        className="h-14 rounded-xl font-display font-bold text-base tracking-tight"
      >
        <Check className="w-5 h-5 mr-2" />
        Confirmar Despacho do Lote
      </Button>
    </div>
  );
}
