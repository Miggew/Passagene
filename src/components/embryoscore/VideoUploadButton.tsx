/**
 * Botao de upload de video para analise EmbryoScore
 *
 * Suporta multiplos videos por acasalamento.
 * Apos upload, roda detecao de circulos (OpenCV.js), abre preview para confirmacao,
 * e retorna bboxes confirmados pelo usuario.
 */

import { useRef, useState } from 'react';
import { useEmbryoVideoUpload } from '@/hooks/useEmbryoVideoUpload';
import { extractCropsFromFrame } from '@/lib/embryoscore/detectCircles';
import { supabase } from '@/lib/supabase';
import { Video, Plus, Check, Loader2, AlertCircle, ScanSearch } from 'lucide-react';
import { DetectionPreview } from './DetectionPreview';
import type { DetectedBbox } from '@/lib/types';

interface VideoUploadButtonProps {
  acasalamentoId: string;
  loteFivId: string;
  disabled?: boolean;
  /** Quantos videos ja foram enviados para este acasalamento */
  videoCount?: number;
  /** Total de bboxes detectados em todos os videos */
  detectedCount?: number;
  /** Contagem esperada de embrioes (do banco) */
  expectedEmbryoCount?: number;
  onUploadComplete: (
    acasalamentoId: string,
    mediaId: string,
    detectedBboxes?: DetectedBbox[] | null,
    detectionConfidence?: 'high' | 'medium' | 'low' | null,
    cropPaths?: string[] | null,
  ) => void;
}

interface PendingPreview {
  frameCanvas: HTMLCanvasElement;
  bboxes: DetectedBbox[];
  result: Awaited<ReturnType<ReturnType<typeof useEmbryoVideoUpload>['upload']>>;
}

export function VideoUploadButton({
  acasalamentoId,
  loteFivId,
  disabled = false,
  videoCount = 0,
  detectedCount = 0,
  expectedEmbryoCount,
  onUploadComplete,
}: VideoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, progress, error, mediaId, detecting, upload, reset } = useEmbryoVideoUpload();
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await upload(file, loteFivId, acasalamentoId, expectedEmbryoCount);
    if (result) {
      if (result.detectedBboxes && result.detectedBboxes.length > 0 && result.frameCanvas) {
        setPendingPreview({
          frameCanvas: result.frameCanvas,
          bboxes: result.detectedBboxes,
          result,
        });
      } else {
        onUploadComplete(
          acasalamentoId,
          result.mediaId,
          result.detectedBboxes,
          result.detectionConfidence,
          result.cropPaths,
        );
        // Reset hook para permitir proximo upload
        reset();
      }
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handlePreviewConfirm = async (confirmedBboxes: DetectedBbox[]) => {
    if (!pendingPreview?.result) return;
    const { result, frameCanvas } = pendingPreview;

    // Verificar se bboxes foram modificados (adição/remoção)
    const bboxesChanged = confirmedBboxes.length !== pendingPreview.bboxes.length ||
      confirmedBboxes.some((b, i) =>
        b.x_percent !== pendingPreview.bboxes[i]?.x_percent ||
        b.y_percent !== pendingPreview.bboxes[i]?.y_percent,
      );

    let finalCropPaths = result.cropPaths;

    // Re-extrair e re-upload crops se bboxes mudaram
    if (bboxesChanged && frameCanvas && confirmedBboxes.length > 0) {
      try {
        const newCrops = extractCropsFromFrame(frameCanvas, confirmedBboxes);
        if (newCrops.length > 0) {
          const cropTimestamp = Date.now();
          const uploadedPaths = await Promise.all(
            newCrops.map(async (blob, i) => {
              if (blob.size === 0) return null;
              const cropPath = `${loteFivId}/${acasalamentoId}/crops/${cropTimestamp}_confirmed_${i}.jpg`;
              const { error: cropErr } = await supabase.storage
                .from('embryo-videos')
                .upload(cropPath, blob, { contentType: 'image/jpeg', upsert: false });
              if (cropErr) {
                console.warn(`[VideoUpload] Re-crop ${i} upload falhou:`, cropErr.message);
                return null;
              }
              return cropPath;
            })
          );
          const validPaths = uploadedPaths.filter((p): p is string => p !== null);
          if (validPaths.length > 0) {
            finalCropPaths = validPaths;
            console.log(`[VideoUpload] Re-extraídos ${validPaths.length} crops após edição de bboxes`);
          }
        }
      } catch (err) {
        console.warn('[VideoUpload] Re-extração de crops falhou (não-bloqueante):', err);
      }
    }

    setPendingPreview(null);
    onUploadComplete(
      acasalamentoId,
      result.mediaId,
      confirmedBboxes,
      result.detectionConfidence,
      finalCropPaths,
    );
    reset();
  };

  const handlePreviewCancel = () => {
    if (!pendingPreview?.result) return;
    const { result } = pendingPreview;
    setPendingPreview(null);
    onUploadComplete(
      acasalamentoId,
      result.mediaId,
      null,
      null,
      null,
    );
    reset();
  };

  // Preview de deteccao pendente
  if (pendingPreview) {
    return (
      <>
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-8 h-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Preview</span>
        </div>
        <DetectionPreview
          frameCanvas={pendingPreview.frameCanvas}
          bboxes={pendingPreview.bboxes}
          expectedCount={expectedEmbryoCount}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      </>
    );
  }

  // Estado: deteccao de circulos em andamento
  if (detecting) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-8 h-8 rounded-md bg-violet-500/15 flex items-center justify-center">
          <ScanSearch className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-pulse" />
        </div>
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Detectando...</span>
      </div>
    );
  }

  // Estado: upload em andamento
  if (uploading) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center relative">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
      </div>
    );
  }

  // Estado: erro
  if (error) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => { reset(); handleClick(); }}
          className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
          title={error}
        >
          <AlertCircle className="w-4 h-4 text-red-500" />
        </button>
        <span className="text-[9px] text-red-500">Tentar</span>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // Estado: tem videos enviados — mostrar resumo + botao adicionar
  if (videoCount > 0) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {videoCount} {videoCount === 1 ? 'video' : 'videos'}
            </span>
            {expectedEmbryoCount && expectedEmbryoCount > 0 && (
              <span className={`text-[9px] font-medium ${detectedCount >= expectedEmbryoCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {detectedCount}/{expectedEmbryoCount} det.
              </span>
            )}
          </div>
          <button
            onClick={handleClick}
            disabled={disabled}
            className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Adicionar outro video"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // Estado: pronto para upload (nenhum video ainda)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={handleClick}
        disabled={disabled}
        className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Enviar video do microscopio"
      >
        <Video className="w-4 h-4" />
      </button>
      <span className="text-[9px] text-muted-foreground">Filmar</span>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
