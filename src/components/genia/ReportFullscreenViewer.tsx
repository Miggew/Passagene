import { useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface ReportFullscreenViewerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onExportPdf?: () => void;
  children: React.ReactNode;
}

export default function ReportFullscreenViewer({
  open,
  onClose,
  title,
  onExportPdf,
  children,
}: ReportFullscreenViewerProps) {
  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while fullscreen is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-md shrink-0">
        <h2 className="text-sm font-bold text-foreground truncate flex-1 mr-4">{title}</h2>
        <div className="flex items-center gap-1">
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Exportar PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content with zoom/pan */}
      <div className="flex-1 overflow-hidden relative">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
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
                  justifyContent: 'center',
                  padding: '24px 16px',
                }}
              >
                <div className="w-full max-w-2xl">
                  {children}
                </div>
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
      </div>
    </div>
  );
}
