/**
 * Dashboard de scores por lote FIV — v2 + backward compatible v1.
 *
 * v2: Distribuição por classe (BE/BN/BX/BL/BI/Mo/Dg), concordância biólogo × IA,
 *     maturidade do atlas.
 * v1: Score médio + distribuição por faixa (legacy).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { useAtlasStats } from '@/hooks/useEmbryoReview';
import { Brain, BarChart3, Users } from 'lucide-react';

interface LoteScoreDashboardProps {
  loteFivId: string;
  totalEmbrioes?: number;
}

const CLASS_COLORS: Record<string, string> = {
  BE: 'bg-emerald-500',
  BN: 'bg-green-500',
  BX: 'bg-amber-500',
  BL: 'bg-blue-500',
  BI: 'bg-sky-400',
  Mo: 'bg-purple-500',
  Dg: 'bg-red-500',
};

const CLASS_ORDER = ['BE', 'BN', 'BX', 'BL', 'BI', 'Mo', 'Dg'];

export function LoteScoreDashboard({ loteFivId, totalEmbrioes }: LoteScoreDashboardProps) {
  const { data: scores = [] } = useQuery<EmbryoScore[]>({
    queryKey: ['lote-scores-dashboard', loteFivId],
    queryFn: async () => {
      const { data: embrioes } = await supabase
        .from('embrioes')
        .select('id')
        .eq('lote_fiv_id', loteFivId);

      if (!embrioes?.length) return [];

      const { data, error } = await supabase
        .from('embryo_scores')
        .select('*')
        .in('embriao_id', embrioes.map(e => e.id))
        .eq('is_current', true);

      if (error) throw error;
      return (data || []) as EmbryoScore[];
    },
    enabled: !!loteFivId,
    staleTime: 30_000,
  });

  // Detect if any score is v2
  const hasV2 = scores.some(s => s.combined_classification != null || s.embedding != null || s.knn_votes != null);

  if (hasV2) {
    return <V2Dashboard scores={scores} totalEmbrioes={totalEmbrioes} />;
  }

  return <V1Dashboard scores={scores} totalEmbrioes={totalEmbrioes} />;
}

// ─── v2 Dashboard ───

function V2Dashboard({ scores, totalEmbrioes }: { scores: EmbryoScore[]; totalEmbrioes?: number }) {
  const { data: atlasStats } = useAtlasStats();

  const stats = useMemo(() => {
    // Count by combined class (biologist overrides AI)
    const classCounts: Record<string, number> = {};
    let classified = 0;
    let biologistClassified = 0;
    let agreed = 0;

    for (const s of scores) {
      const cls = s.biologist_classification || s.combined_classification;
      if (!cls) continue;
      classCounts[cls] = (classCounts[cls] || 0) + 1;
      classified++;

      if (s.biologist_classification) {
        biologistClassified++;
        if (s.combined_classification && s.biologist_classification === s.combined_classification) {
          agreed++;
        }
      }
    }

    // Sort by class order
    const distribution = CLASS_ORDER
      .filter(cls => classCounts[cls])
      .map(cls => ({ cls, count: classCounts[cls] }));

    // Add any classes not in CLASS_ORDER
    for (const [cls, count] of Object.entries(classCounts)) {
      if (!CLASS_ORDER.includes(cls)) {
        distribution.push({ cls, count });
      }
    }

    const concordance = biologistClassified > 0
      ? Math.round((agreed / biologistClassified) * 100)
      : null;

    return { distribution, classified, biologistClassified, agreed, concordance };
  }, [scores]);

  if (!stats.classified) return null;

  return (
    <div className="rounded-xl border border-border glass-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">EmbryoScore do Lote</h3>
          <p className="text-xs text-muted-foreground">
            {stats.classified}{totalEmbrioes ? `/${totalEmbrioes}` : ''} analisados
          </p>
        </div>
      </div>

      {/* Class distribution bars */}
      <div className="space-y-1.5">
        {stats.distribution.map(({ cls, count }) => {
          const pct = stats.classified > 0 ? Math.round((count / stats.classified) * 100) : 0;
          return (
            <div key={cls} className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold w-6 text-foreground">{cls}</span>
              <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${CLASS_COLORS[cls] || 'bg-primary'}`}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-14 text-right">{count} ({pct}%)</span>
            </div>
          );
        })}
      </div>

      {/* Concordance biologist × AI */}
      {stats.concordance != null && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
          <Users className="w-4 h-4 text-primary/60" />
          <div className="flex-1">
            <span className="text-xs text-muted-foreground">Concordância biólogo × IA</span>
            <span className="ml-2 text-sm font-semibold text-foreground">
              {stats.concordance}% ({stats.agreed}/{stats.biologistClassified})
            </span>
          </div>
        </div>
      )}

      {/* Atlas maturity */}
      {atlasStats && (
        <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
          <Brain className="w-3.5 h-3.5" />
          <span>
            Atlas: {atlasStats.total.toLocaleString()} cross-species + {atlasStats.bovine_real.toLocaleString()} reais
          </span>
        </div>
      )}
    </div>
  );
}

// ─── v1 Dashboard (legacy) ───

function V1Dashboard({ scores, totalEmbrioes }: { scores: EmbryoScore[]; totalEmbrioes?: number }) {
  const stats = useMemo(() => {
    if (!scores.length) return null;

    const avgScore = Math.round(scores.reduce((s, sc) => s + sc.embryo_score, 0) / scores.length);

    const distribution = {
      excelente: scores.filter(s => s.embryo_score >= 80).length,
      bom: scores.filter(s => s.embryo_score >= 60 && s.embryo_score < 80).length,
      regular: scores.filter(s => s.embryo_score >= 40 && s.embryo_score < 60).length,
      borderline: scores.filter(s => s.embryo_score >= 20 && s.embryo_score < 40).length,
      inviavel: scores.filter(s => s.embryo_score < 20).length,
    };

    return { avgScore, distribution, total: scores.length };
  }, [scores]);

  if (!stats) return null;

  const distBars = [
    { label: 'Excelente', count: stats.distribution.excelente, color: 'bg-green-500' },
    { label: 'Bom', count: stats.distribution.bom, color: 'bg-emerald-500' },
    { label: 'Regular', count: stats.distribution.regular, color: 'bg-amber-500' },
    { label: 'Borderline', count: stats.distribution.borderline, color: 'bg-orange-500' },
    { label: 'Inviável', count: stats.distribution.inviavel, color: 'bg-red-500' },
  ];

  return (
    <div className="rounded-xl border border-border glass-panel p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">EmbryoScore do Lote</h3>
          <p className="text-xs text-muted-foreground">
            {stats.total}{totalEmbrioes ? `/${totalEmbrioes}` : ''} analisados
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-2">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{stats.avgScore}</div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Média</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {distBars.map(bar => {
          const pct = stats.total > 0 ? (bar.count / stats.total) * 100 : 0;
          if (bar.count === 0) return null;
          return (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 text-right">{bar.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar.color}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <span className="text-xs font-medium w-6 text-right">{bar.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
