/**
 * Dashboard de scores por lote FIV.
 * Mobile-first: cards compactos empilhados.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Brain, TrendingUp, Activity } from 'lucide-react';

interface LoteScoreDashboardProps {
  loteFivId: string;
  totalEmbrioes?: number;
}

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
        .eq('is_current', true)
        .order('embryo_score', { ascending: false });

      if (error) throw error;
      return (data || []) as EmbryoScore[];
    },
    enabled: !!loteFivId,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    if (!scores.length) return null;

    const avgScore = Math.round(scores.reduce((s, sc) => s + sc.embryo_score, 0) / scores.length);
    const avgMorph = Math.round(scores.reduce((s, sc) => s + (sc.morph_score || 0), 0) / scores.length);
    const avgKinetic = Math.round(scores.reduce((s, sc) => s + (sc.kinetic_score || 0), 0) / scores.length);

    const distribution = {
      excelente: scores.filter(s => s.embryo_score >= 80).length,
      bom: scores.filter(s => s.embryo_score >= 60 && s.embryo_score < 80).length,
      regular: scores.filter(s => s.embryo_score >= 40 && s.embryo_score < 60).length,
      borderline: scores.filter(s => s.embryo_score >= 20 && s.embryo_score < 40).length,
      inviavel: scores.filter(s => s.embryo_score < 20).length,
    };

    return { avgScore, avgMorph, avgKinetic, distribution, total: scores.length };
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
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

      {/* Score médio em destaque */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className={`text-3xl font-bold ${getScoreColor(stats.avgScore)}`}>
            {stats.avgScore}
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Média</span>
        </div>

        {/* Morph vs Kinetic */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <span className="text-lg font-semibold">{stats.avgMorph}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Morfologia</span>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-lg font-semibold">{stats.avgKinetic}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Cinética</span>
          </div>
        </div>
      </div>

      {/* Distribution bars */}
      <div className="space-y-1.5">
        {distBars.map(bar => {
          const pct = stats.total > 0 ? (bar.count / stats.total) * 100 : 0;
          if (bar.count === 0) return null;
          return (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 text-right">{bar.label}</span>
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
