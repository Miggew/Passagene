/**
 * Imagem do crop do embrião direto do Storage.
 *
 * v2: Suporta bucket `embryoscore` (novo) e `embryo-videos` (legacy).
 * Se `score.crop_image_path` existe → signed URL → <img>
 * Fallback: placeholder ImageOff para scores antigos sem crop.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { Loader2, ImageOff } from 'lucide-react';

interface EmbryoHighlightFrameProps {
  score: EmbryoScore;
  /** @deprecated Não utilizado */
  allScores?: EmbryoScore[];
  className?: string;
}

/**
 * Determine which bucket the crop is stored in.
 * v2 scores (with knn_classification) use 'embryoscore' bucket.
 * v1 scores use 'embryo-videos' bucket.
 */
function getBucket(score: EmbryoScore): string {
  if (score.knn_classification != null || score.combined_source != null) {
    return 'embryoscore';
  }
  // v2.3: crop_image_path com "/" indica formato novo (acasalamento_id/queue_id/emb_N.jpg)
  if (score.crop_image_path && score.crop_image_path.includes('/')) {
    return 'embryoscore';
  }
  return 'embryo-videos';
}

export function EmbryoHighlightFrame({ score, className = '' }: EmbryoHighlightFrameProps) {
  const hasCrop = !!score.crop_image_path;
  const bucket = getBucket(score);

  const { data: signedUrl, isLoading } = useQuery({
    queryKey: ['embryo-crop-url', bucket, score.crop_image_path],
    queryFn: async () => {
      if (!score.crop_image_path) return null;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(score.crop_image_path, 60 * 60); // 1h
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: hasCrop,
    staleTime: 30 * 60 * 1000, // 30min
  });

  // Sem crop → placeholder
  if (!hasCrop) {
    return (
      <div
        className={`relative overflow-hidden rounded-lg border border-border/50 bg-muted/30 shrink-0 flex items-center justify-center ${className}`}
        style={{ width: 200, height: 200 }}
      >
        <ImageOff className="w-5 h-5 text-muted-foreground/40" />
      </div>
    );
  }

  // v2: Show class badge instead of numeric score
  const isV2 = score.combined_classification != null || score.embedding != null || score.knn_votes != null;
  const badgeLabel = isV2
    ? score.combined_classification
    : String(Math.round(score.embryo_score));

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border/50 bg-muted/30 shrink-0 ${className}`}
      style={{ width: 200, height: 200 }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
      )}

      {signedUrl && (
        <img
          src={signedUrl}
          alt={isV2 ? `Embrião — ${score.combined_classification}` : `Embrião — ${score.classification} (Score ${Math.round(score.embryo_score)})`}
          className="w-full h-full object-cover"
        />
      )}

      {/* Badge overlay */}
      {signedUrl && (
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm">
          <span className="text-xs font-bold text-white font-mono">
            {badgeLabel}
          </span>
        </div>
      )}
    </div>
  );
}
