/**
 * Editor inline para seção Portfolio de Serviços.
 * Upload de fotos com caption e resultado opcionais.
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderPlus, Loader2, X } from 'lucide-react';
import { useProfileUpload } from '@/hooks/useProfileUpload';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import type { ServicePortfolioContent } from '@/lib/types';

interface ServicePortfolioEditorProps {
  items: ServicePortfolioContent['items'];
  onChange: (items: ServicePortfolioContent['items']) => void;
  sectionId?: string;
}

function PortfolioThumb({
  item,
  onRemove,
  onFieldChange,
}: {
  item: ServicePortfolioContent['items'][number];
  onRemove: () => void;
  onFieldChange: (field: 'caption' | 'resultado', value: string) => void;
}) {
  const { data: url } = useProfileUrl(item.foto_url);

  return (
    <div className="group relative rounded-lg border border-border overflow-hidden bg-card">
      <div className="aspect-square bg-muted">
        {url ? (
          <img src={url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Carregando...
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="p-1.5 space-y-1">
        <Input
          value={item.caption || ''}
          onChange={(e) => onFieldChange('caption', e.target.value)}
          placeholder="Descrição (opcional)"
          className="h-7 text-[11px] border-0 bg-transparent p-1 focus-visible:ring-0"
        />
        <Input
          value={item.resultado || ''}
          onChange={(e) => onFieldChange('resultado', e.target.value)}
          placeholder="Resultado (opcional)"
          className="h-7 text-[11px] border-0 bg-transparent p-1 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

export default function ServicePortfolioEditor({ items, onChange, sectionId }: ServicePortfolioEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useProfileUpload();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    const newItems = [...items];

    for (const file of Array.from(files)) {
      try {
        const path = await upload.mutateAsync({
          file,
          options: { folder: 'sections', subfolder: sectionId || 'unsorted' },
        });
        newItems.push({ foto_url: path, caption: '', resultado: '' });
      } catch {
        // error handled in hook
      }
    }

    onChange(newItems);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: 'caption' | 'resultado', value: string) => {
    const updated = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Grid de itens */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item, i) => (
            <PortfolioThumb
              key={item.foto_url}
              item={item}
              onRemove={() => handleRemove(i)}
              onFieldChange={(field, value) => handleFieldChange(i, field, value)}
            />
          ))}
        </div>
      )}

      {/* Upload button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <FolderPlus className="w-4 h-4 mr-2" />
            Adicionar Trabalho
          </>
        )}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
