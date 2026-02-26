import { useState } from 'react';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { PhotoGalleryContent } from '@/lib/types';

interface PhotoGallerySectionProps {
  content: PhotoGalleryContent;
}

function GalleryThumb({ photo, onClick }: { photo: PhotoGalleryContent['photos'][number]; onClick: () => void }) {
  const { data: url } = useProfileUrl(photo.url);

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
    >
      {url ? (
        <img src={url} alt={photo.caption || ''} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
          Carregando...
        </div>
      )}
    </button>
  );
}

export default function PhotoGallerySection({ content }: PhotoGallerySectionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto = selectedIndex !== null ? content.photos[selectedIndex] : null;

  if (!content.photos?.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma foto adicionada.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {content.photos.map((photo, i) => (
          <GalleryThumb key={i} photo={photo} onClick={() => setSelectedIndex(i)} />
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedPhoto && <LightboxImage photo={selectedPhoto} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LightboxImage({ photo }: { photo: PhotoGalleryContent['photos'][number] }) {
  const { data: url } = useProfileUrl(photo.url);

  return (
    <div className="flex flex-col">
      {url && (
        <img src={url} alt={photo.caption || ''} className="w-full max-h-[80vh] object-contain bg-black" />
      )}
      {photo.caption && (
        <p className="p-3 text-sm text-muted-foreground">{photo.caption}</p>
      )}
    </div>
  );
}
