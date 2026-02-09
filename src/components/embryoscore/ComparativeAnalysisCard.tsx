/**
 * Card de análise comparativa entre embriões do mesmo acasalamento
 *
 * Mostra ranking e comparação quando há múltiplos embriões com score.
 */

import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Trophy, TrendingUp, Brain } from 'lucide-react';

interface ComparativeAnalysisCardProps {
  scores: EmbryoScore[];
  embriaoIdentificacoes?: Record<string, string>; // id → identificacao
}

function getRecommendationLabel(rec: string) {
  switch (rec) {
    case 'priority': return 'Prioridade';
    case 'recommended': return 'Recomendado';
    case 'conditional': return 'Condicional';
    case 'second_opinion': return '2ª Opinião';
    case 'discard': return 'Descarte';
    default: return rec;
  }
}

export function ComparativeAnalysisCard({ scores, embriaoIdentificacoes = {} }: ComparativeAnalysisCardProps) {
  if (scores.length < 2) return null;

  // Ordenar por score decrescente
  const sorted = [...scores].sort((a, b) => b.embryo_score - a.embryo_score);

  // Calcular médias
  const avgScore = scores.reduce((sum, s) => sum + s.embryo_score, 0) / scores.length;
  const avgMorph = scores.reduce((sum, s) => sum + (s.morph_score || 0), 0) / scores.length;
  const avgKinetic = scores.reduce((sum, s) => sum + (s.kinetic_score || 0), 0) / scores.length;

  // Classificação
  const distribution: Record<string, number> = {};
  scores.forEach(s => {
    distribution[s.classification] = (distribution[s.classification] || 0) + 1;
  });

  // Recomendação
  const recDistribution: Record<string, number> = {};
  scores.forEach(s => {
    recDistribution[s.transfer_recommendation] = (recDistribution[s.transfer_recommendation] || 0) + 1;
  });

  const best = sorted[0];
  const bestColors = getScoreColor(best.embryo_score);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
        <div className="w-1 h-5 rounded-full bg-primary/50" />
        <TrendingUp className="w-4 h-4 text-primary/60" />
        <span className="text-sm font-semibold text-foreground">Análise Comparativa</span>
        <span className="text-xs text-muted-foreground ml-auto">{scores.length} embriões</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Médias */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold text-foreground">{Math.round(avgScore)}</div>
            <div className="text-[10px] text-muted-foreground">Score Médio</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold text-foreground">{Math.round(avgMorph)}</div>
            <div className="text-[10px] text-muted-foreground">Morfo Médio</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold text-foreground">{Math.round(avgKinetic)}</div>
            <div className="text-[10px] text-muted-foreground">Cinét Médio</div>
          </div>
        </div>

        {/* Ranking */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Ranking</span>
          </div>
          <div className="space-y-1.5">
            {sorted.map((score, index) => {
              const colors = getScoreColor(score.embryo_score);
              const identificacao = embriaoIdentificacoes[score.embriao_id] || `Embrião ${index + 1}`;
              const isFirst = index === 0;

              return (
                <div
                  key={score.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isFirst
                      ? `${colors.bg} ring-1 ${colors.ring}`
                      : 'bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  {/* Posição */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isFirst
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isFirst ? colors.text : 'text-foreground'} truncate block`}>
                      {identificacao}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {score.classification} · {getRecommendationLabel(score.transfer_recommendation)}
                    </span>
                  </div>

                  {/* Score */}
                  <div className={`text-right shrink-0`}>
                    <div className={`text-sm font-bold ${colors.text}`}>
                      {Math.round(score.embryo_score)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      M:{Math.round(score.morph_score || 0)} C:{Math.round(score.kinetic_score || 0)}
                    </div>
                  </div>

                  {/* Medalha para o melhor */}
                  {isFirst && (
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribuição */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/30">
          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(distribution).map(([classification, count]) => (
              <span
                key={classification}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {count}× {classification}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
