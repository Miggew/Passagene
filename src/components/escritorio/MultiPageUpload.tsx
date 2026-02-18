import { useState } from 'react';
import { Plus, X, FileImage, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageData {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: unknown;
  error?: string;
}

interface MultiPageUploadProps {
  onAllProcessed: (results: unknown[]) => void;
  processPage: (file: File, pageIndex: number) => Promise<unknown>;
  disabled?: boolean;
}

export default function MultiPageUpload({ onAllProcessed, processPage, disabled }: MultiPageUploadProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [processing, setProcessing] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const newPages: PageData[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        status: 'pending' as const,
      }));
    setPages(prev => [...prev, ...newPages]);
  };

  const removePage = (index: number) => {
    setPages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const processAll = async () => {
    setProcessing(true);
    const results: unknown[] = [];

    for (let i = 0; i < pages.length; i++) {
      setPages(prev => prev.map((p, j) => j === i ? { ...p, status: 'processing' } : p));

      try {
        const result = await processPage(pages[i].file, i);
        results.push(result);
        setPages(prev => prev.map((p, j) => j === i ? { ...p, status: 'done', result } : p));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro';
        setPages(prev => prev.map((p, j) => j === i ? { ...p, status: 'error', error: errorMsg } : p));
      }
    }

    setProcessing(false);
    if (results.length > 0) {
      onAllProcessed(results);
    }
  };

  return (
    <div className="space-y-4">
      {/* Thumbnails das páginas */}
      {pages.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pages.map((page, i) => (
            <div
              key={i}
              className={cn(
                'relative flex-shrink-0 w-24 h-32 rounded-lg border overflow-hidden',
                page.status === 'processing' && 'border-primary',
                page.status === 'done' && 'border-green-500',
                page.status === 'error' && 'border-red-500',
                page.status === 'pending' && 'border-border',
              )}
            >
              <img src={page.preview} alt={`Página ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute top-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5">
                Pág {i + 1}
              </div>
              {page.status === 'processing' && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {!processing && (
                <button
                  onClick={() => removePage(i)}
                  className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full text-white hover:bg-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || processing}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = () => { if (input.files) addFiles(input.files); };
            input.click();
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Página
        </Button>
        {pages.length > 0 && (
          <Button
            size="sm"
            onClick={processAll}
            disabled={processing || pages.every(p => p.status === 'done')}
          >
            <FileImage className="w-4 h-4 mr-1" />
            {processing ? 'Processando...' : `Processar ${pages.length} página${pages.length > 1 ? 's' : ''}`}
          </Button>
        )}
      </div>
    </div>
  );
}
