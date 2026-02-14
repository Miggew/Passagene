/**
 * Botao de upload de video para analise EmbryoScore
 *
 * Suporta multiplos videos por acasalamento.
 * Detecção e análise são feitas server-side pela Edge Function embryo-analyze.
 */

import { useRef } from 'react';
import { useEmbryoVideoUpload } from '@/hooks/useEmbryoVideoUpload';
import { Video, Plus, Check, Loader2, AlertCircle } from 'lucide-react';
import { CameraRecorder } from '@/components/camera';

interface VideoUploadButtonProps {
  acasalamentoId: string;
  loteFivId: string;
  disabled?: boolean;
  /** Quantos videos ja foram enviados para este acasalamento */
  videoCount?: number;
  onUploadComplete: (
    acasalamentoId: string,
    mediaId: string,
  ) => void;
}

export function VideoUploadButton({
  acasalamentoId,
  loteFivId,
  disabled = false,
  videoCount = 0,
  onUploadComplete,
}: VideoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, progress, error, upload, reset } = useEmbryoVideoUpload();

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await upload(file, loteFivId, acasalamentoId);
    if (result) {
      onUploadComplete(acasalamentoId, result.mediaId);
      reset();
    }

    if (inputRef.current) inputRef.current.value = '';
  };

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
          </div>
          <button
            onClick={handleClick}
            disabled={disabled}
            className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Adicionar arquivo de video"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <CameraRecorder
            acasalamentoId={acasalamentoId}
            loteFivId={loteFivId}
            disabled={disabled}
            onRecordingComplete={onUploadComplete}
          />
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
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleClick}
          disabled={disabled}
          className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={disabled ? "Informe a quantidade de embrioes primeiro" : "Enviar arquivo de video"}
        >
          <Video className="w-4 h-4" />
        </button>
        <CameraRecorder
          acasalamentoId={acasalamentoId}
          loteFivId={loteFivId}
          disabled={disabled}
          onRecordingComplete={onUploadComplete}
        />
      </div>
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
