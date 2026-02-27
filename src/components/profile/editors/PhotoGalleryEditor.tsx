/**
 * Editor inline para seção Galeria de Fotos.
 * Upload de fotos com caption opcional.
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useProfileUpload } from '@/hooks/useProfileUpload';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import { toast } from 'sonner';
import type { PhotoGalleryContent } from '@/lib/types';

interface PhotoGalleryEditorProps {
  photos: PhotoGalleryContent['photos'];
  onChange: (photos: PhotoGalleryContent['photos']) => void;
  sectionId?: string;
}

function PhotoThumb({
  photo,
  onRemove,
  onCaptionChange,
}: {
  photo: PhotoGalleryContent['photos'][number];
  onRemove: () => void;
  onCaptionChange: (caption: string) => void;
}) {
  const { data: url } = useProfileUrl(photo.url);

  return (
    <div className="group relative rounded-lg border border-border overflow-hidden bg-card">
      <div className="aspect-square bg-muted">
        {url ? (
          <img src={url} alt={photo.caption || ''} className="w-full h-full object-cover" loading="lazy" />
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
      <div className="p-1.5">
        <Input
          value={photo.caption || ''}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Legenda (opcional)"
          className="h-7 text-[11px] border-0 bg-transparent p-1 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

export default function PhotoGalleryEditor({ photos, onChange, sectionId }: PhotoGalleryEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useProfileUpload();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    const newPhotos = [...photos];

    for (const file of Array.from(files)) {
      try {
        const path = await upload.mutateAsync({
          file,
          options: { folder: 'sections', subfolder: sectionId || 'unsorted' },
        });
        newPhotos.push({ url: path, caption: '' });
      } catch {
        // error handled in hook
      }
    }

    onChange(newPhotos);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updated = photos.map((p, i) => (i === index ? { ...p, caption } : p));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <PhotoThumb
              key={photo.url}
              photo={photo}
              onRemove={() => handleRemove(i)}
              onCaptionChange={(caption) => handleCaptionChange(i, caption)}
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
            <ImagePlus className="w-4 h-4 mr-2" />
            Adicionar Foto
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
