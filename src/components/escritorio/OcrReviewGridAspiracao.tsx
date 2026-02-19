import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, Image } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';
import ZoomableImage from './ZoomableImage';
import type { OcrAspiracaoRow, OcrField } from '@/lib/types/escritorio';
import { cn } from '@/lib/utils';

interface OcrReviewGridAspiracaoProps {
  rows: OcrAspiracaoRow[];
  imageUrl?: string;
  imageUrls?: string[];
  onSave: (rows: OcrAspiracaoRow[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

const NUM_COLS = ['atresicos', 'degenerados', 'expandidos', 'desnudos', 'viaveis', 'total'] as const;
const NUM_LABELS: Record<string, string> = {
  atresicos: 'ATR', degenerados: 'DEG', expandidos: 'EXP',
  desnudos: 'DES', viaveis: 'VIA', total: 'Total',
};

export default function OcrReviewGridAspiracao({
  rows: initialRows, imageUrl, imageUrls, onSave, onCancel, saving = false,
}: OcrReviewGridAspiracaoProps) {
  const [rows, setRows] = useState<OcrAspiracaoRow[]>(initialRows);

  const urls = imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const hasImages = urls.length > 0;

  const [showImage, setShowImage] = useState(true);

  const updateField = (rowIdx: number, field: string, value: string | number) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const f = row[field as keyof OcrAspiracaoRow] as OcrField;
      return {
        ...row,
        [field]: { ...f, value, original_value: f.original_value ?? f.value },
      };
    }));
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
                  <th className="px-1 py-1.5 text-left font-medium text-muted-foreground w-[110px]">Registro</th>
                  <th className="px-1 py-1.5 text-left font-medium text-muted-foreground w-[60px]">Raça</th>
                  {NUM_COLS.map(col => (
                    <th key={col} className="px-0.5 py-1.5 text-center font-medium text-muted-foreground w-[42px]">
                      {NUM_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-1 py-1 text-muted-foreground text-xs">{row.numero}</td>
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <Input
                          value={row.registro.value}
                          onChange={e => updateField(i, 'registro', e.target.value)}
                          className={cn(
                            'h-7 text-sm w-[100px]',
                            row.registro.confidence < 70 && 'border-red-300 dark:border-red-700',
                            row.registro.confidence >= 70 && row.registro.confidence < 90 && 'border-amber-300 dark:border-amber-700',
                          )}
                        />
                        <ConfidenceBadge confidence={row.registro.confidence} showValue={false} />
                      </div>
                    </td>
                    <td className="px-0.5 py-1">
                      <Input
                        value={row.raca.value}
                        onChange={e => updateField(i, 'raca', e.target.value)}
                        className="h-7 text-sm w-[56px]"
                      />
                    </td>
                    {NUM_COLS.map(col => {
                      const field = row[col] as OcrField<number>;
                      return (
                        <td key={col} className="px-0.5 py-1">
                          <Input
                            type="number"
                            min={0}
                            value={field.value || ''}
                            onChange={e => updateField(i, col, Number(e.target.value) || 0)}
                            className={cn(
                              'h-7 text-xs text-center w-[38px] px-1',
                              field.confidence < 70 && 'border-red-300 dark:border-red-700',
                              field.confidence >= 70 && field.confidence < 90 && 'border-amber-300 dark:border-amber-700',
                            )}
                          />
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
              <RotateCcw className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={() => onSave(rows)} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Salvando...' : 'Importar Dados'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
