import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, Image } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';
import ZoomableImage from './ZoomableImage';
import type { OcrRow, OcrField } from '@/lib/types/escritorio';
import { cn } from '@/lib/utils';

interface OcrReviewGridProps {
  rows: OcrRow[];
  /** Single image (backward compat) */
  imageUrl?: string;
  /** Multiple page images */
  imageUrls?: string[];
  onSave: (rows: OcrRow[]) => void;
  onCancel: () => void;
  columns?: ('registro' | 'raca' | 'resultado' | 'obs')[];
  resultadoLabel?: string;
  saving?: boolean;
}

export default function OcrReviewGrid({
  rows: initialRows,
  imageUrl,
  imageUrls,
  onSave,
  onCancel,
  columns = ['registro', 'raca', 'resultado', 'obs'],
  resultadoLabel = 'Resultado',
  saving = false,
}: OcrReviewGridProps) {
  const [rows, setRows] = useState<OcrRow[]>(initialRows);

  // Merge imageUrl / imageUrls into a single array
  const urls = imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const hasImages = urls.length > 0;

  const [showImage, setShowImage] = useState(true);

  const updateField = (rowIdx: number, field: keyof OcrRow, value: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const f = row[field] as OcrField;
      return {
        ...row,
        [field]: { ...f, value, original_value: f.original_value ?? f.value },
      };
    }));
  };

  const columnLabels: Record<string, string> = {
    registro: 'Registro',
    raca: 'Raça',
    resultado: resultadoLabel,
    obs: 'Obs',
  };

  return (
    <div className="space-y-4">
      {/* Toggle image button */}
      {hasImages && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowImage(v => !v)}>
            <Image className="w-4 h-4 mr-1" />
            {showImage ? 'Ocultar Foto' : 'Ver Foto do Relatório'}
          </Button>
        </div>
      )}

      {/* Side-by-side: image 1/3, table 2/3 */}
      <div className={cn(hasImages && showImage ? 'lg:flex lg:gap-3' : '')}>
        {hasImages && showImage && (
          <div className="mb-4 lg:mb-0 lg:w-1/3 lg:flex-shrink-0">
            <ZoomableImage urls={urls} />
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-1 py-1.5 text-left font-medium text-muted-foreground w-7">#</th>
                  {columns.map(col => (
                    <th key={col} className="px-1 py-1.5 text-left font-medium text-muted-foreground">
                      {columnLabels[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-1 py-1 text-muted-foreground text-xs">{row.numero}</td>
                    {columns.map(col => {
                      const field = row[col] as OcrField;
                      return (
                        <td key={col} className="px-1 py-1">
                          <div className="flex items-center gap-0.5">
                            <Input
                              value={field.value}
                              onChange={(e) => updateField(i, col, e.target.value)}
                              className={cn(
                                'h-7 text-sm',
                                field.confidence < 70 && 'border-red-300 dark:border-red-700',
                                field.confidence >= 70 && field.confidence < 90 && 'border-amber-300 dark:border-amber-700',
                              )}
                            />
                            <ConfidenceBadge confidence={field.confidence} showValue={false} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={() => onSave(rows)} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
