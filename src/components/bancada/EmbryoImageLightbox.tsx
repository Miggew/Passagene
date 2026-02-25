/**
 * EmbryoImageLightbox — Fullscreen overlay with zoom/pan for embryo images.
 *
 * Tabs: Crop | Motion Map
 * Controls: Zoom in/out, reset, close (ESC)
 * Pattern follows ReportFullscreenViewer.
 */

import { useCallback, useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

type Tab = 'crop' | 'motion';

interface EmbryoImageLightboxProps {
  open: boolean;
  onClose: () => void;
  cropUrl: string | null | undefined;
  motionUrl: string | null | undefined;
  initialTab?: Tab;
  label?: string;
}

export function EmbryoImageLightbox({
  open,
  onClose,
  cropUrl,
  motionUrl,
  initialTab = 'crop',
  label,
}: EmbryoImageLightboxProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  // Set tab to the requested one when opening
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const currentUrl = tab === 'crop' ? cropUrl : motionUrl;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          {label && <span className="text-sm font-bold text-foreground">{label}</span>}
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setTab('crop')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === 'crop'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Melhor Frame
            </button>
            <button
              onClick={() => setTab('motion')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === 'motion'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mapa Cinético
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar (ESC)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content with zoom/pan */}
      <div className="flex-1 overflow-hidden relative">
        {currentUrl ? (
          <TransformWrapper
            key={tab}
            initialScale={1}
            minScale={0.5}
            maxScale={8}
            doubleClick={{ mode: 'reset' }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{
                    width: '100%',
                    minHeight: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                  }}
                >
                  <img
                    src={currentUrl}
                    alt={tab === 'crop' ? 'Embrião' : 'Mapa cinético'}
                    className="max-w-full max-h-[80vh] rounded-lg"
                    style={{ imageRendering: 'auto' }}
                  />
                </TransformComponent>

                {/* Floating zoom controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/90 backdrop-blur-md border border-border/60 rounded-xl shadow-lg p-1 z-10">
                  <button
                    onClick={() => zoomOut()}
                    className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Diminuir zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => resetTransform()}
                    className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Resetar zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => zoomIn()}
                    className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </TransformWrapper>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sem imagem disponível
          </div>
        )}
      </div>
    </div>
  );
}
