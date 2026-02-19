/**
 * Card expandível de EmbryoScore — v2 + backward compatible v1.
 *
 * v2 (KNN + DINOv2 + MLP):
 *   - Classe combinada (BE/BN/BX/BL/BI/Mo/Dg)
 *   - Barras de votação KNN
 *   - Indicador de fonte (knn/knn_mlp_agree/disagree/mlp_only/insufficient)
 *   - Métricas cinéticas (intensidade, harmonia, simetria, estabilidade)
 *   - Classificação do biólogo
 *
 * v1 (Gemini legacy):
 *   - Score numérico + classificação textual
 *   - Sub-scores morfologia/cinética
 *   - Reasoning
 */

import { useState } from 'react';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { EmbryoHighlightFrame } from './EmbryoHighlightFrame';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Eye,
  Activity,
  MessageSquare,
  Shield,
  Check,
} from 'lucide-react';
import { getKineticDiagnosis, getLabelClasses } from '@/lib/embryoscore/kinetic-labels';

interface EmbryoScoreCardProps {
  score: EmbryoScore;
  allScores?: EmbryoScore[];
  defaultExpanded?: boolean;
  classificacaoManual?: string;
}

const SOURCE_LABELS: Record<string, { icon: string; label: string }> = {
  knn: { icon: '🤖', label: 'KNN' },
  knn_mlp_agree: { icon: '🤖', label: 'KNN + Classificador ✓' },
  knn_mlp_disagree: { icon: '⚠️', label: 'KNN vs Classificador' },
  mlp_only: { icon: '💡', label: 'Classificador' },
  insufficient: { icon: '🔍', label: 'Manual' },
};

const CLASS_COLORS: Record<string, string> = {
  BE: 'text-emerald-600 dark:text-emerald-400',
  BN: 'text-green-600 dark:text-green-400',
  BX: 'text-amber-600 dark:text-amber-400',
  BL: 'text-blue-600 dark:text-blue-400',
  BI: 'text-sky-600 dark:text-sky-400',
  Mo: 'text-purple-600 dark:text-purple-400',
  Dg: 'text-red-600 dark:text-red-400',
};

export function EmbryoScoreCard({ score, allScores, defaultExpanded = false, classificacaoManual }: EmbryoScoreCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isV2 = score.combined_classification != null;

  return (
    <div className={`rounded-lg border border-border/60 overflow-hidden transition-all ${expanded ? 'shadow-sm' : ''}`}>
      {/* Header compacto */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        {isV2 ? <V2Header score={score} /> : <V1Header score={score} />}

        <div className="shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10 px-3 py-3 space-y-4">
          {isV2 ? (
            <V2Details score={score} allScores={allScores} />
          ) : (
            <V1Details score={score} allScores={allScores} classificacaoManual={classificacaoManual} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── v2 Header ───

function V2Header({ score }: { score: EmbryoScore }) {
  const cls = score.biologist_classification || score.combined_classification || '?';
  const clsColor = CLASS_COLORS[cls] || 'text-foreground';
  const source = score.combined_source || 'insufficient';
  const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.insufficient;

  return (
    <>
      {/* Class badge */}
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
        <span className={`font-mono text-sm font-bold leading-none ${clsColor}`}>{cls}</span>
        {score.combined_confidence != null && (
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5">
            {score.combined_confidence}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${clsColor}`}>{cls}</span>
          {score.biologist_classification && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
              <Check className="w-3 h-3" /> Biólogo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {sourceInfo.icon} {sourceInfo.label}
          </span>
          {score.knn_real_bovine_count != null && (
            <span className="text-[10px] text-muted-foreground">
              · {score.knn_real_bovine_count} refs reais
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ─── v2 Details ───

function V2Details({ score, allScores }: { score: EmbryoScore; allScores?: EmbryoScore[] }) {
  const votes = score.knn_votes || {};
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
  const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const source = score.combined_source || 'insufficient';

  return (
    <>
      {/* Crop image */}
      <EmbryoHighlightFrame score={score} allScores={allScores} />

      {/* KNN vote bars */}
      {sortedVotes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Votação KNN</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{totalVotes} vizinhos</span>
          </div>
          <div className="space-y-1.5 pl-5">
            {sortedVotes.map(([cls, count]) => {
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={cls} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold w-6 text-foreground">{cls}</span>
                  <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-sm transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MLP disagree */}
      {source === 'knn_mlp_disagree' && score.mlp_classification && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
          <span>💡 Classificador sugere:</span>
          <span className="font-mono font-bold">{score.mlp_classification}</span>
          {score.mlp_confidence != null && (
            <span className="text-xs text-muted-foreground">({score.mlp_confidence}%)</span>
          )}
        </div>
      )}

      {/* Insufficient / mlp_only notes */}
      {source === 'insufficient' && (
        <div className="text-xs text-muted-foreground italic px-2">
          Atlas em construção ({score.knn_real_bovine_count || 0} referências reais).
        </div>
      )}
      {source === 'mlp_only' && (
        <div className="text-xs text-muted-foreground italic px-2">
          {score.knn_real_bovine_count || 0} referências reais — classificação baseada no classificador treinado.
        </div>
      )}

      {/* Gemini IA section — separate from biologist */}
      {score.gemini_classification && (
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Gemini IA</span>
            {score.ai_confidence != null && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Confiança: {Math.round(score.ai_confidence * 100)}%
              </span>
            )}
          </div>

          <div className="pl-5 space-y-2">
            <div className="flex items-center gap-3">
              <span className={`font-mono text-lg font-bold ${CLASS_COLORS[score.gemini_classification] || 'text-foreground'}`}>
                {score.gemini_classification}
              </span>
              {score.stage_code != null && (
                <div className="flex gap-2">
                  <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                    {STAGE_LABELS[score.stage_code] || `Estágio ${score.stage_code}`}
                  </span>
                  {score.quality_grade != null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      score.quality_grade === 1 ? 'bg-green-500/10 text-green-600' :
                      score.quality_grade === 2 ? 'bg-emerald-500/10 text-emerald-600' :
                      score.quality_grade === 3 ? 'bg-amber-500/10 text-amber-600' :
                      'bg-red-500/10 text-red-600'
                    }`}>
                      {QUALITY_LABELS[score.quality_grade] || `Grau ${score.quality_grade}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {score.gemini_reasoning && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {score.gemini_reasoning}
              </p>
            )}

            {score.visual_features && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Características Visuais:</span>
                <div className="flex flex-wrap gap-1.5">
                  {score.visual_features.extruded_cells && <FeatureBadge label="Células Extrusas" color="amber" />}
                  {score.visual_features.dark_cytoplasm && <FeatureBadge label="Citoplasma Escuro" color="red" />}
                  {score.visual_features.zona_pellucida_intact === false && <FeatureBadge label="ZP Danificada" color="red" />}
                  {score.visual_features.debris_in_zona && <FeatureBadge label="Debris na ZP" color="orange" />}
                  {score.visual_features.shape && score.visual_features.shape !== 'spherical' && (
                    <FeatureBadge label={`Formato: ${score.visual_features.shape}`} color="blue" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kinetic diagnosis */}
      {score.kinetic_intensity != null && (() => {
        const diag = getKineticDiagnosis(score);
        return (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Cinética</span>
            </div>
            <div className="flex flex-wrap gap-2 pl-5">
              <KineticLabel label="Atividade" diagnosis={diag.activity} />
              <KineticLabel label="Distribuição" diagnosis={diag.distribution} />
              <KineticLabel label="Estabilidade" diagnosis={diag.stability} />
            </div>
          </div>
        );
      })()}

      {/* Processing info */}
      {score.model_used && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
          <Brain className="w-3 h-3" />
          <span>Modelo: {score.model_used}</span>
          {score.processing_time_ms && (
            <>
              <span className="mx-1">·</span>
              <span>{(score.processing_time_ms / 1000).toFixed(1)}s</span>
            </>
          )}
        </div>
      )}
    </>
  );
}

const STAGE_LABELS: Record<number, string> = {
  3: 'Mórula Inicial',
  4: 'Mórula',
  5: 'Blasto Inicial',
  6: 'Blastocisto',
  7: 'Blasto Expandido',
  8: 'Blasto Eclodido',
  9: 'Blasto Eclodido Exp.'
};

const QUALITY_LABELS: Record<number, string> = {
  1: 'Grau 1 (Excelente)',
  2: 'Grau 2 (Bom)',
  3: 'Grau 3 (Regular)',
  4: 'Grau 4 (Ruim/Morto)'
};

function FeatureBadge({ label, color }: { label: string; color: 'amber' | 'red' | 'blue' | 'orange' }) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[color]}`}>
      {label}
    </span>
  );
}

function KineticLabel({ label, diagnosis }: { label: string; diagnosis: { label: string; color: 'green' | 'amber' | 'red' } }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLabelClasses(diagnosis.color)}`}>
        {diagnosis.label}
      </span>
    </div>
  );
}

// ─── v1 Header (legacy Gemini) ───

// ─── v1 Header (legacy Gemini) ───

function V1Header({ score }: { score: EmbryoScore }) {
  const scoreColors = getScoreColor(score.embryo_score);

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-10 h-10 rounded-lg ${scoreColors.bg} flex flex-col items-center justify-center`}>
          <span className={`text-sm font-bold leading-none ${scoreColors.text}`}>
            {Math.round(score.embryo_score)}
          </span>
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5">Score</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${scoreColors.text}`}>{score.classification}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {score.transfer_recommendation && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
              {score.transfer_recommendation.replace('_', ' ')}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            <Shield className="w-3 h-3 inline -mt-0.5 mr-0.5" />
            {score.confidence}
          </span>
        </div>
      </div>
    </>
  );
}

// ─── v1 Details (legacy Gemini) ───

function V1Details({ score, allScores }: { score: EmbryoScore; allScores?: EmbryoScore[]; classificacaoManual?: string }) {
  return (
    <>
      {score.reasoning ? (
        <div className="flex gap-3 items-start">
          <EmbryoHighlightFrame score={score} allScores={allScores} />
          <div className="flex gap-2 flex-1 min-w-0">
            <MessageSquare className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80 leading-relaxed">{score.reasoning}</p>
          </div>
        </div>
      ) : (
        <EmbryoHighlightFrame score={score} allScores={allScores} />
      )}

      {/* Legacy Morfologia/Cinética removed as columns were dropped from DB. 
          Use V2/V3 for detailed analysis. */}

      {/* Meta */}
      {score.model_used && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
          <Brain className="w-3 h-3" />
          <span>Modelo: {score.model_used}</span>
          {score.processing_time_ms && (
            <>
              <span className="mx-1">·</span>
              <span>{(score.processing_time_ms / 1000).toFixed(1)}s</span>
            </>
          )}
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}: </span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  );
}
