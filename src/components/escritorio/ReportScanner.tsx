import { useState, useRef } from 'react';
import { Upload, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type ScanStep = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface ReportScannerProps {
  onResult?: (result: unknown) => void;
  onImageUrl?: (url: string) => void;
  uploadAndProcess?: (file: File) => Promise<unknown>;
  /** Preview-only mode: captures file locally without uploading */
  onFileSelected?: (file: File) => void;
  disabled?: boolean;
}

const stepLabels: Record<ScanStep, string> = {
  idle: '',
  uploading: 'Enviando imagem...',
  processing: 'Processando OCR com IA...',
  done: 'Extração concluída!',
  error: 'Erro no processamento',
};

const stepProgress: Record<ScanStep, number> = {
  idle: 0,
  uploading: 30,
  processing: 70,
  done: 100,
  error: 0,
};

export default function ReportScanner({ onResult, onImageUrl, uploadAndProcess, onFileSelected, disabled }: ReportScannerProps) {
  const [step, setStep] = useState<ScanStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewOnly = !!onFileSelected;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Arquivo deve ser uma imagem (JPEG ou PNG)');
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));

    // Preview-only: just capture the file, don't upload
    if (previewOnly) {
      onFileSelected(file);
      return;
    }

    if (!uploadAndProcess || !onResult) return;

    try {
      setStep('uploading');
      setStep('processing');
      const result = await uploadAndProcess(file);
      setStep('done');
      onResult(result);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Preview-only mode: show captured image with option to change
  if (previewOnly && preview) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg overflow-hidden border border-border max-h-48">
          <img src={preview} alt="Preview do relatório" className="w-full h-full object-contain" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPreview(null);
            inputRef.current?.click();
          }}
        >
          <Camera className="w-4 h-4 mr-1" /> Trocar Foto
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  if (step !== 'idle' && step !== 'error') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {step === 'done' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">{stepLabels[step]}</span>
        </div>
        <Progress value={stepProgress[step]} className="h-2" />
        {preview && (
          <div className="rounded-lg overflow-hidden border border-border max-h-48">
            <img
              src={preview}
              alt="Preview do relatório"
              className="w-full h-full object-contain"
              onLoad={() => { if (onImageUrl && preview) onImageUrl(preview); }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          disabled
            ? 'border-border/50 bg-muted/20 cursor-not-allowed'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
        )}
      >
        <div className="p-3 rounded-full bg-muted">
          <Upload className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Arraste uma foto ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPEG ou PNG — foto do relatório de campo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={disabled}>
            <Camera className="w-4 h-4 mr-1" />
            Tirar Foto
          </Button>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Upload className="w-4 h-4 mr-1" />
            Selecionar Arquivo
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
