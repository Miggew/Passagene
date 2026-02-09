/**
 * Card expandível de EmbryoScore
 *
 * Estados:
 *   - Sem vídeo: não renderiza nada
 *   - Processando: skeleton + spinner + "Analisando..."
 *   - Erro: badge vermelho "Falha na análise" + retry info
 *   - Completo: card com score, classificação, recomendação
 *
 * Layout compacto (linha do embrião):
 *   🟢 78  Bom  │ Bl. Expandido │ Prioridade │
 *
 * Layout expandido (ao clicar):
 *   - Detalhes morfológicos (ICM, TE, ZP, fragmentação)
 *   - Detalhes cinéticos (movimento, pulsação, estabilidade)
 *   - Indicadores de viabilidade (tags)
 *   - Reasoning completo
 */

import { useState } from 'react';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { DiscrepancyAlert } from './DiscrepancyAlert';
import { BiologistFeedback } from './BiologistFeedback';
import { EmbryoHighlightFrame } from './EmbryoHighlightFrame';
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Eye,
  Activity,
  Target,
  MessageSquare,
  Shield,
  AlertTriangle,
} from 'lucide-react';

interface EmbryoScoreCardProps {
  score: EmbryoScore;
  /** Todos os scores do mesmo acasalamento (para contexto visual no frame) */
  allScores?: EmbryoScore[];
  defaultExpanded?: boolean;
  classificacaoManual?: string;
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

function getRecommendationColor(rec: string) {
  switch (rec) {
    case 'priority': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'recommended': return 'bg-green-500/15 text-green-700 dark:text-green-400';
    case 'conditional': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'second_opinion': return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
    case 'discard': return 'bg-red-500/15 text-red-700 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getConfidenceLabel(confidence: string) {
  switch (confidence) {
    case 'high': return 'Alta';
    case 'medium': return 'Média';
    case 'low': return 'Baixa';
    default: return confidence;
  }
}

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'high': return 'text-emerald-600 dark:text-emerald-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    case 'low': return 'text-red-600 dark:text-red-400';
    default: return 'text-muted-foreground';
  }
}

export function EmbryoScoreCard({ score, allScores, defaultExpanded = false, classificacaoManual }: EmbryoScoreCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = getScoreColor(score.embryo_score);

  return (
    <div className={`rounded-lg border border-border/60 overflow-hidden transition-all ${expanded ? 'shadow-sm' : ''}`}>
      {/* Header compacto — sempre visível */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Score circle */}
        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
          <span className={`text-sm font-bold ${colors.text}`}>
            {Math.round(score.embryo_score)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${colors.text}`}>
              {score.classification}
            </span>
            {score.stage && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground truncate">
                  {score.stage}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRecommendationColor(score.transfer_recommendation)}`}>
              {getRecommendationLabel(score.transfer_recommendation)}
            </span>
            <span className={`text-[10px] ${getConfidenceColor(score.confidence)}`}>
              <Shield className="w-3 h-3 inline -mt-0.5 mr-0.5" />
              {getConfidenceLabel(score.confidence)}
            </span>
          </div>
        </div>

        {/* Scores compactos + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {score.morph_score != null && (
            <div className="text-center hidden sm:block">
              <div className="text-xs font-semibold text-foreground">{Math.round(score.morph_score)}</div>
              <div className="text-[9px] text-muted-foreground">Morfo</div>
            </div>
          )}
          {score.kinetic_score != null && (
            <div className="text-center hidden sm:block">
              <div className="text-xs font-semibold text-foreground">{Math.round(score.kinetic_score)}</div>
              <div className="text-[9px] text-muted-foreground">Cinét</div>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10 px-3 py-3 space-y-4">
          {/* Frame anotado + Reasoning lado a lado */}
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

          {/* Morfologia */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Morfologia</span>
              {score.morph_score != null && (
                <span className="text-xs font-bold text-primary ml-auto">{Math.round(score.morph_score)}/100</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-5">
              {score.stage && (
                <DetailRow label="Estágio" value={score.stage} />
              )}
              {score.icm_grade && (
                <DetailRow label="ICM" value={`${score.icm_grade}${score.icm_description ? ` — ${score.icm_description}` : ''}`} />
              )}
              {score.te_grade && (
                <DetailRow label="TE" value={`${score.te_grade}${score.te_description ? ` — ${score.te_description}` : ''}`} />
              )}
              {score.zp_status && (
                <DetailRow label="Zona Pelúcida" value={score.zp_status} />
              )}
              {score.fragmentation && (
                <DetailRow label="Fragmentação" value={score.fragmentation} />
              )}
            </div>
            {score.morph_notes && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-5 italic">{score.morph_notes}</p>
            )}
          </div>

          {/* Cinética */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Cinética</span>
              {score.kinetic_score != null && (
                <span className="text-xs font-bold text-primary ml-auto">{Math.round(score.kinetic_score)}/100</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-5">
              {score.global_motion && (
                <DetailRow label="Movimento" value={score.global_motion} />
              )}
              {score.blastocele_pulsation && (
                <DetailRow label="Pulsação" value={score.blastocele_pulsation} />
              )}
              {score.stability && (
                <DetailRow label="Estabilidade" value={score.stability} />
              )}
              {score.icm_activity && (
                <DetailRow label="Atividade ICM" value={score.icm_activity} />
              )}
              {score.te_activity && (
                <DetailRow label="Atividade TE" value={score.te_activity} />
              )}
              {score.most_active_region && (
                <DetailRow label="Região mais ativa" value={score.most_active_region} />
              )}
            </div>
            {score.kinetic_notes && (
              <p className="text-[11px] text-muted-foreground mt-1.5 pl-5 italic">{score.kinetic_notes}</p>
            )}
          </div>

          {/* Indicadores de viabilidade */}
          {score.viability_indicators && score.viability_indicators.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Indicadores de Viabilidade</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-5">
                {score.viability_indicators.map((indicator, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {indicator}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Posição no vídeo */}
          {score.position_description && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/30">
              <Brain className="w-3 h-3" />
              <span>Posição: {score.position_description}</span>
              {score.model_used && (
                <>
                  <span className="mx-1">·</span>
                  <span>Modelo: {score.model_used}</span>
                </>
              )}
              {score.processing_time_ms && (
                <>
                  <span className="mx-1">·</span>
                  <span>{(score.processing_time_ms / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
          )}

          {/* Alerta de divergência de contagem IA vs banco */}
          {score.raw_response?._meta?.count_mismatch && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                <span className="font-medium">Divergência de contagem: </span>
                IA detectou {score.raw_response._meta.embryos_detected_by_ai} embriões no vídeo,
                banco possui {score.raw_response._meta.embryos_in_db}.
                <span className="text-amber-600/70 dark:text-amber-400/70"> O mapeamento pode não corresponder exatamente.</span>
              </div>
            </div>
          )}

          {/* Alerta de discrepância biólogo vs IA */}
          {classificacaoManual && (
            <DiscrepancyAlert
              classificacaoManual={classificacaoManual}
              scoreIA={score.embryo_score}
              classificationIA={score.classification}
            />
          )}

          {/* Feedback do biólogo */}
          <BiologistFeedback score={score} />
        </div>
      )}
    </div>
  );
}

// Sub-componente para linhas de detalhe
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}: </span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  );
}
