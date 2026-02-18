import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';
import type { OcrRow, OcrField } from '@/lib/types/escritorio';
import { cn } from '@/lib/utils';

interface OcrReviewGridProps {
  rows: OcrRow[];
  imageUrl?: string;
  onSave: (rows: OcrRow[]) => void;
  onCancel: () => void;
  /** Colunas visíveis (default: todas) */
  columns?: ('registro' | 'raca' | 'resultado' | 'obs')[];
  /** Labels customizados para a coluna resultado */
  resultadoLabel?: string;
  saving?: boolean;
}

export default function OcrReviewGrid({
  rows: initialRows,
  imageUrl,
  onSave,
  onCancel,
  columns = ['registro', 'raca', 'resultado', 'obs'],
  resultadoLabel = 'Resultado',
  saving = false,
}: OcrReviewGridProps) {
  const [rows, setRows] = useState<OcrRow[]>(initialRows);

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
    <div className="flex gap-4 h-full">
      {/* Foto original (lado esquerdo) */}
      {imageUrl && (
        <div className="hidden lg:block w-1/2 rounded-lg border border-border overflow-hidden bg-muted/20">
          <img
            src={imageUrl}
            alt="Relatório original"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Grid de dados (lado direito) */}
      <div className={cn('flex-1 space-y-4', !imageUrl && 'w-full')}>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                {columns.map(col => (
                  <th key={col} className="px-2 py-2 text-left font-medium text-muted-foreground">
                    {columnLabels[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-2 py-1.5 text-muted-foreground">{row.numero}</td>
                  {columns.map(col => {
                    const field = row[col] as OcrField;
                    return (
                      <td key={col} className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
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
  );
}
