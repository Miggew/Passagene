import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmbryoVideoUpload } from '@/hooks/useEmbryoVideoUpload';
import EmbryoCamera from './EmbryoCamera';

interface CameraRecorderProps {
  acasalamentoId: string;
  loteFivId: string;
  disabled?: boolean;
  onRecordingComplete: (acasalamentoId: string, mediaId: string) => void;
}

export function CameraRecorder({
  acasalamentoId,
  loteFivId,
  disabled = false,
  onRecordingComplete,
}: CameraRecorderProps) {
  const [open, setOpen] = useState(false);
  const { uploading, progress, upload, reset } = useEmbryoVideoUpload();

  const handleVideoConfirmed = async (blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `camera_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
    const file = new File([blob], fileName, { type: blob.type });

    const result = await upload(file, loteFivId, acasalamentoId);
    if (result) {
      onRecordingComplete(acasalamentoId, result.mediaId);
      reset();
      setOpen(false);
    }
  };

  if (uploading) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Gravar com câmera"
      >
        <Camera className="w-4 h-4" />
      </button>

      <DialogContent
        className="max-w-none w-screen h-screen m-0 p-0 rounded-none border-none left-0 top-0 translate-x-0 translate-y-0 [&>button:last-child]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Câmera de Embriões</DialogTitle>
        <EmbryoCamera onVideoConfirmed={handleVideoConfirmed} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
