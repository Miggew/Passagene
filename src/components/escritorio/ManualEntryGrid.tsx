import { useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  width?: string;
  readOnly?: boolean;
  /** Renderizador customizado para a célula */
  render?: (row: T, rowIdx: number, onChange: (value: string) => void) => React.ReactNode;
  /** Atalhos de tecla → valor (ex: { P: 'PRENHE', V: 'VAZIA' }) */
  shortcuts?: Record<string, string>;
  /** Auto-avançar para próxima linha após atalho */
  autoAdvance?: boolean;
}

interface ManualEntryGridProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: ColumnDef<T>[];
  onRowChange: (rowIdx: number, field: string, value: string) => void;
  /** Callback quando Enter é pressionado na última coluna */
  onNextRow?: (currentRowIdx: number) => void;
  className?: string;
  getRowClassName?: (row: T, idx: number) => string;
}

export default function ManualEntryGrid<T extends Record<string, unknown>>({
  rows,
  columns,
  onRowChange,
  onNextRow,
  className,
  getRowClassName,
}: ManualEntryGridProps<T>) {
  const gridRef = useRef<HTMLDivElement>(null);

  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    if (!gridRef.current) return;
    const selector = `[data-row="${rowIdx}"][data-col="${colIdx}"] input`;
    const input = gridRef.current.querySelector<HTMLInputElement>(selector);
    input?.focus();
    input?.select();
  }, []);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    col: ColumnDef<T>,
  ) => {
    // Atalhos de tecla (single-key shortcuts)
    if (col.shortcuts && e.key.length === 1) {
      const upper = e.key.toUpperCase();
      if (col.shortcuts[upper]) {
        e.preventDefault();
        onRowChange(rowIdx, col.key, col.shortcuts[upper]);
        if (col.autoAdvance) {
          // Avança para próxima linha, mesma coluna
          if (rowIdx < rows.length - 1) {
            setTimeout(() => focusCell(rowIdx + 1, colIdx), 50);
          }
        }
        return;
      }
    }

    switch (e.key) {
      case 'Tab':
        // Tab navega entre colunas editáveis
        if (!e.shiftKey) {
          const nextCol = columns.findIndex((c, i) => i > colIdx && !c.readOnly);
          if (nextCol >= 0) {
            e.preventDefault();
            focusCell(rowIdx, nextCol);
          } else if (rowIdx < rows.length - 1) {
            // Próxima linha, primeira coluna editável
            e.preventDefault();
            const firstEditable = columns.findIndex(c => !c.readOnly);
            focusCell(rowIdx + 1, firstEditable >= 0 ? firstEditable : 0);
          }
        } else {
          // Shift+Tab volta
          const prevCol = columns.slice(0, colIdx).reverse().findIndex(c => !c.readOnly);
          if (prevCol >= 0) {
            e.preventDefault();
            focusCell(rowIdx, colIdx - 1 - prevCol);
          } else if (rowIdx > 0) {
            e.preventDefault();
            const lastEditable = columns.length - 1 - [...columns].reverse().findIndex(c => !c.readOnly);
            focusCell(rowIdx - 1, lastEditable);
          }
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (rowIdx < rows.length - 1) {
          focusCell(rowIdx + 1, colIdx);
        } else {
          onNextRow?.(rowIdx);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, colIdx);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
        break;
    }
  }, [columns, rows.length, onRowChange, onNextRow, focusCell]);

  return (
    <div ref={gridRef} className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-2 py-2 text-left font-medium text-muted-foreground w-10">#</th>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-2 py-2 text-left font-medium text-muted-foreground"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={cn(
                'border-b border-border/50 hover:bg-muted/20',
                getRowClassName?.(row, rowIdx),
              )}
            >
              <td className="px-2 py-1.5 text-muted-foreground">{rowIdx + 1}</td>
              {columns.map((col, colIdx) => (
                <td
                  key={col.key}
                  className="px-2 py-1.5"
                  data-row={rowIdx}
                  data-col={colIdx}
                >
                  {col.render ? (
                    col.render(row, rowIdx, (v) => onRowChange(rowIdx, col.key, v))
                  ) : col.readOnly ? (
                    <span className="text-muted-foreground">{String(row[col.key] ?? '')}</span>
                  ) : (
                    <Input
                      value={String(row[col.key] ?? '')}
                      onChange={(e) => onRowChange(rowIdx, col.key, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx, col)}
                      className="h-7 text-sm"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
