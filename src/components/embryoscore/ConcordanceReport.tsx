import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { Brain, AlertTriangle, CheckCircle } from 'lucide-react';

interface ConcordanceData {
  total: number;
  concordant: number;
  concordancePercent: number;
  byRange: Array<{
    range: string;
    total: number;
    concordant: number;
    percent: number;
  }>;
}

export function ConcordanceReport() {
  const { data: scores, isLoading } = useQuery({
    queryKey: ['embryo-scores-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embryo_scores')
        .select('*')
        .eq('is_current', true)
        .not('biologo_concorda', 'is', null);

      if (error) throw error;
      return data as EmbryoScore[];
    },
  });

  const concordanceData = useMemo<ConcordanceData>(() => {
    if (!scores || scores.length === 0) {
      return {
        total: 0,
        concordant: 0,
        concordancePercent: 0,
        byRange: [],
      };
    }

    const ranges = [
      { min: 0, max: 20, label: '0-20' },
      { min: 20, max: 40, label: '20-40' },
      { min: 40, max: 60, label: '40-60' },
      { min: 60, max: 80, label: '60-80' },
      { min: 80, max: 100, label: '80-100' },
    ];

    const byRange = ranges.map(({ min, max, label }) => {
      const rangeScores = scores.filter(
        (s) => s.embryo_score >= min && s.embryo_score < max
      );
      const concordant = rangeScores.filter((s) => s.biologo_concorda === true).length;

      return {
        range: label,
        total: rangeScores.length,
        concordant,
        percent: rangeScores.length > 0 ? (concordant / rangeScores.length) * 100 : 0,
      };
    });

    const concordant = scores.filter((s) => s.biologo_concorda === true).length;
    const concordancePercent = (concordant / scores.length) * 100;

    return {
      total: scores.length,
      concordant,
      concordancePercent,
      byRange,
    };
  }, [scores]);

  const getColorClasses = (percent: number) => {
    if (percent >= 70) return 'text-green-600 dark:text-green-400';
    if (percent >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getIconColorClasses = (percent: number) => {
    if (percent >= 70) return 'bg-green-500/15 border-green-500/30';
    if (percent >= 50) return 'bg-amber-500/15 border-amber-500/30';
    return 'bg-red-500/15 border-red-500/30';
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border glass-panel overflow-hidden">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Brain className="w-5 h-5 animate-pulse" />
            <span className="text-sm">Carregando dados de concordância...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="rounded-xl border border-border glass-panel overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
          <div className="w-1 h-5 rounded-full bg-primary/50" />
          <h2 className="text-sm font-semibold text-foreground">Concordância com Biólogo</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center mb-3">
            <Brain className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Nenhum feedback registrado ainda
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Use o campo "Biólogo concorda?" nas análises para começar
          </p>
        </div>
      </div>
    );
  }

  const { total, concordant, concordancePercent, byRange } = concordanceData;
  const showAlert = concordancePercent < 70;

  return (
    <div className="rounded-xl border border-border glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
        <div className="w-1 h-5 rounded-full bg-primary/50" />
        <h2 className="text-sm font-semibold text-foreground">Concordância com Biólogo</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Overall Concordance */}
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-xl flex items-center justify-center border ${getIconColorClasses(
              concordancePercent
            )}`}
          >
            {concordancePercent >= 70 ? (
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getColorClasses(concordancePercent)}`}>
                {concordancePercent.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">concordância</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {concordant} de {total} feedbacks concordaram
            </p>
          </div>
        </div>

        {/* Alert if low concordance */}
        {showAlert && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Concordância abaixo do esperado
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                Recomendado: revisar critérios de análise ou ajustar prompts
              </p>
            </div>
          </div>
        )}

        {/* Breakdown by range */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Por faixa de score
          </h3>
          <div className="space-y-2">
            {byRange.map(({ range, total: rangeTotal, concordant: rangeConcordant, percent }) => (
              <div key={range} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{range}</span>
                  <span className="font-medium text-foreground">
                    {rangeConcordant}/{rangeTotal} ({percent > 0 ? percent.toFixed(0) : 0}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      percent >= 70
                        ? 'bg-green-500'
                        : percent >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${rangeTotal > 0 ? percent : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary/60" />
            <span className="text-xs text-muted-foreground">
              Total de {total} análises com feedback registrado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
