import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ZoomableImageProps {
  urls: string[];
  className?: string;
}

export default function ZoomableImage({ urls, className }: ZoomableImageProps) {
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const switchPage = useCallback((idx: number) => {
    setPageIdx(idx);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.003)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pageIdx]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => setZoom(z => Math.min(5, z + 0.4)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.5, z - 0.4)), []);

  if (!urls.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={containerRef}
        className={`rounded-lg border border-border overflow-hidden bg-muted/20 select-none touch-none ${className ?? 'h-[50vh] lg:h-[65vh] max-h-[700px]'}`}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={resetView}
      >
        <img
          src={urls[pageIdx]}
          alt={`Relatório página ${pageIdx + 1}`}
          draggable={false}
          loading="lazy"
          className="w-full h-full object-contain origin-center pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragging.current ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {urls.length > 1 && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageIdx === 0} onClick={() => switchPage(pageIdx - 1)} aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">
              Pág. {pageIdx + 1}/{urls.length}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageIdx === urls.length - 1} onClick={() => switchPage(pageIdx + 1)} aria-label="Próximo">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
          </>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} aria-label="Diminuir zoom">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} aria-label="Aumentar zoom">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Resetar zoom" aria-label="Resetar zoom">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
