/**
 * BancadaEmbryoDetailPanel — Rich detail panel for the selected embryo.
 *
 * Sections:
 *   1. Header with label + navigation + hotkey hints
 *   2. Images: Crop + Motion Map + EmbryoMinimap (clickable → lightbox)
 *   3. Kinetics: Activity / Distribution / Stability badges
 *   4. Combined IA: Classification + confidence + source
 *   5. KNN vote bars
 *   6. Gemini IA: Classification + IETS + full reasoning + visual features
 *   7. Atlas ref count
 *   8. Classification buttons (BiologistClassButtons)
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Activity, Brain } from 'lucide-react';
import type { ClassificacaoEmbriao } from '@/lib/types';
import type { BancadaPlateScore } from '@/hooks/useBancadaJobs';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { BiologistClassButtons } from '@/components/embryoscore/BiologistClassButtons';
import { getKineticDiagnosis, getLabelClasses } from '@/lib/embryoscore/kinetic-labels';
import { EmbryoImageLightbox } from './EmbryoImageLightbox';

const STAGE_LABELS: Record<number, string> = {
  3: 'Mórula Inicial',
  4: 'Mórula',
  5: 'Blasto Inicial',
  6: 'Blastocisto',
  7: 'Blasto Expandido',
  8: 'Blasto Eclodido',
  9: 'Blasto Eclodido Exp.',
};

const QUALITY_LABELS: Record<number, string> = {
  1: 'Grau 1 (Excelente)',
  2: 'Grau 2 (Bom)',
  3: 'Grau 3 (Regular)',
  4: 'Grau 4 (Ruim/Morto)',
};

const SOURCE_LABELS: Record<string, { icon: string; text: string }> = {
  knn: { icon: '🤖', text: 'KNN' },
  knn_mlp_agree: { icon: '🤖', text: 'KNN + Classificador concordam' },
  knn_mlp_disagree: { icon: '⚠️', text: 'KNN vs Classificador divergem' },
  mlp_only: { icon: '💡', text: 'Classificador' },
  insufficient: { icon: '🔍', text: 'Manual' },
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

interface BancadaEmbryoDetailPanelProps {
  embryoId: string;
  embryoLabel: string;
  classificacao?: string;
  score: BancadaPlateScore | null;
  onClassify: (cls: ClassificacaoEmbriao) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  selectedClass: ClassificacaoEmbriao | null;
  onSelectClass: (cls: ClassificacaoEmbriao | null) => void;
}

export function BancadaEmbryoDetailPanel({
  embryoLabel,
  score,
  onClassify,
  onUndo,
  canUndo,
  isLoading,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  selectedClass,
  onSelectClass,
}: BancadaEmbryoDetailPanelProps) {
  const { data: cropUrl } = useEmbryoscoreUrl(score?.crop_image_path);
  const { data: motionUrl } = useEmbryoscoreUrl(score?.motion_map_path);
  const [lightboxTab, setLightboxTab] = useState<'crop' | 'motion' | null>(null);

  const source = score?.combined_source || 'insufficient';
  const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.insufficient;

  const votes = score?.knn_votes || {};
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
  const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header — navigation */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border shrink-0">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <kbd className="text-[9px] font-mono text-muted-foreground/50">←</kbd>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            Embrião {embryoLabel}
          </span>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <kbd className="text-[9px] font-mono text-muted-foreground/50">→</kbd>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Images row */}
          <div className="grid grid-cols-2 gap-3">
            <ImageTile
              label="Melhor frame"
              url={cropUrl}
              icon={Eye}
              onClick={() => setLightboxTab('crop')}
            />
            <ImageTile
              label="Mapa cinético"
              url={motionUrl}
              icon={Activity}
              onClick={() => setLightboxTab('motion')}
            />
          </div>

          {/* Kinetic diagnosis — always visible */}
          {score?.kinetic_intensity != null && (() => {
            const diag = getKineticDiagnosis(score);
            return (
              <div className="flex flex-wrap gap-2 px-1">
                {(['Atividade', 'Distribuição', 'Estabilidade'] as const).map((label, i) => {
                  const d = [diag.activity, diag.distribution, diag.stability][i];
                  return (
                    <div key={label} className="flex items-center gap-1 text-[11px]">
                      <span className="text-muted-foreground">{label}:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLabelClasses(d.color)}`}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Combined IA classification */}
          {score?.combined_classification && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                <Brain className="w-3.5 h-3.5 text-primary/60" />
                IA Combinada
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-2xl font-bold ${CLASS_COLORS[score.combined_classification] || 'text-foreground'}`}>
                  {score.combined_classification}
                </span>
                {score.combined_confidence != null && (
                  <span className={`text-sm font-mono font-bold ${score.combined_confidence >= 80 ? 'text-green-500' : 'text-amber-500'}`}>
                    {score.combined_confidence}%
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {sourceInfo.icon} {sourceInfo.text}
                </span>
              </div>
            </div>
          )}

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
                      <span className="text-[10px] text-muted-foreground w-14 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MLP disagree */}
          {source === 'knn_mlp_disagree' && score?.mlp_classification && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <span>Classificador sugere:</span>
              <span className="font-mono font-bold">{score.mlp_classification}</span>
              {score.mlp_confidence != null && (
                <span className="text-[10px] font-mono font-bold text-amber-500">({score.mlp_confidence}%)</span>
              )}
            </div>
          )}

          {/* Gemini IA section */}
          {score?.gemini_classification && (
            <div className="pt-2 border-t border-border/30 space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Gemini IA</span>
                {score.ai_confidence != null && (
                  <span className={`text-[10px] font-mono ml-auto font-bold ${score.ai_confidence >= 0.8 ? 'text-green-500' : 'text-amber-500'}`}>
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

                {/* Full reasoning — no truncation */}
                {score.gemini_reasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {score.gemini_reasoning}
                  </p>
                )}

                {/* Visual features */}
                {score.visual_features && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase">Características Visuais:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {score.visual_features.extruded_cells && <FeatureBadge label="Células Extrusas" color="amber" />}
                      {score.visual_features.dark_cytoplasm && <FeatureBadge label="Citoplasma Escuro" color="red" />}
                      {score.visual_features.zona_pellucida_intact === false && <FeatureBadge label="ZP Danificada" color="red" />}
                      {score.visual_features.debris_in_zona && <FeatureBadge label="Debris na ZP" color="amber" />}
                      {score.visual_features.shape && score.visual_features.shape !== 'spherical' && (
                        <FeatureBadge label={`Formato: ${score.visual_features.shape}`} color="blue" />
                      )}
                      {score.visual_features.zona_pellucida_intact === true && <FeatureBadge label="ZP Intacta" color="green" />}
                      {score.visual_features.shape === 'spherical' && <FeatureBadge label="Esférico" color="green" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Atlas reference count */}
          {score?.knn_real_bovine_count != null && (
            <div className="text-xs text-muted-foreground px-1">
              Atlas: {score.knn_real_bovine_count} referências reais bovinas
            </div>
          )}

          {/* Insufficient data note */}
          {source === 'insufficient' && !score?.gemini_classification && (
            <div className="text-xs text-muted-foreground italic px-2">
              Atlas em construção ({score?.knn_real_bovine_count || 0} referências reais).
              Classifique para treinar o sistema.
            </div>
          )}

          {/* Classification buttons */}
          <div className="pt-2 border-t border-border/30">
            <BiologistClassButtons
              aiSuggestion={score?.combined_classification}
              currentClassification={score?.biologist_classification}
              onClassify={onClassify}
              onUndo={onUndo}
              canUndo={canUndo}
              isLoading={isLoading}
              selected={selectedClass}
              onSelect={onSelectClass}
            />
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      <EmbryoImageLightbox
        open={lightboxTab !== null}
        onClose={() => setLightboxTab(null)}
        cropUrl={cropUrl}
        motionUrl={motionUrl}
        initialTab={lightboxTab || 'crop'}
        label={`Embrião ${embryoLabel}`}
      />
    </>
  );
}

// ─── Internal components ───

function ImageTile({
  label,
  url,
  icon: Icon,
  onClick,
}: {
  label: string;
  url: string | null | undefined;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </span>
      {url ? (
        <img
          src={url}
          alt={label}
          className="w-full aspect-square rounded-lg border border-border object-cover cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          loading="lazy"
          onClick={onClick}
        />
      ) : (
        <div className="w-full aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}

function FeatureBadge({ label, color }: { label: string; color: 'amber' | 'red' | 'blue' | 'green' }) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    green: 'bg-green-500/10 text-green-600 border-green-500/20',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[color]}`}>
      {label}
    </span>
  );
}
