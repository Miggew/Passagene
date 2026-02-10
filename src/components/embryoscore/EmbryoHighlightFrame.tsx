/**
 * Imagem do crop do embrião direto do Storage.
 *
 * Se `score.crop_image_path` existe → signed URL → <img>
 * Fallback: placeholder ImageOff para scores antigos sem crop.
 *
 * Sem <video>, sem <canvas>, sem seek, sem race conditions.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Loader2, ImageOff } from 'lucide-react';

interface EmbryoHighlightFrameProps {
  score: EmbryoScore;
  /** @deprecated Não utilizado */
  allScores?: EmbryoScore[];
  className?: string;
}

export function EmbryoHighlightFrame({ score, className = '' }: EmbryoHighlightFrameProps) {
  const hasCrop = !!score.crop_image_path;

  const { data: signedUrl, isLoading } = useQuery({
    queryKey: ['embryo-crop-url', score.crop_image_path],
    queryFn: async () => {
      if (!score.crop_image_path) return null;
      const { data, error } = await supabase.storage
        .from('embryo-videos')
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

  const colors = getScoreColor(score.embryo_score);

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
          alt={`Embrião — ${score.classification} (Score ${Math.round(score.embryo_score)})`}
          className="w-full h-full object-cover"
        />
      )}

      {/* Badge de score como overlay CSS */}
      {signedUrl && (
        <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded ${colors.bg}`}>
          <span className={`text-xs font-bold ${colors.text}`}>
            {Math.round(score.embryo_score)}
          </span>
        </div>
      )}
    </div>
  );
}
