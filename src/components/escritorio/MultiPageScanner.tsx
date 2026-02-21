import { useRef, useState, useEffect } from 'react';
import { Upload, Camera, X, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MultiPageScannerProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function MultiPageScanner({ files, onFilesChange, disabled }: MultiPageScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // Generate thumbnails whenever files change
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setThumbnails(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const handleNewFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    for (let i = 0; i < incoming.length; i++) {
      if (incoming[i].type.startsWith('image/')) {
        valid.push(incoming[i]);
      }
    }
    if (valid.length === 0) {
      setError('Arquivo deve ser uma imagem (JPEG ou PNG)');
      return;
    }
    setError(null);
    onFilesChange([...files, ...valid]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleNewFiles(e.target.files);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleNewFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  // If we have files, show thumbnails + add button
  if (files.length > 0) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {thumbnails.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-[3/4]">
              <img src={url} alt={`Página ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium">Pág. {i + 1}</span>
              </div>
              <div className="absolute top-0 left-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-br">
                {i + 1}
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Página
        </Button>

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

  // Empty state — drop zone
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
            JPEG ou PNG — adicione várias páginas do relatório
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
