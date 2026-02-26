import { useCallback, useEffect } from 'react';
import { X, Download } from 'lucide-react';

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar (ESC)"
        >
          <X className="w-5 h-5" />
          <span className="text-xs font-medium hidden sm:inline">Fechar</span>
        </button>
        <h2 className="text-sm font-bold text-foreground truncate flex-1 mx-4 text-center">{title}</h2>
        <div className="flex items-center gap-1">
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Baixar PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
