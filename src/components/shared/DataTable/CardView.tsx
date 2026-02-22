import { ReactNode } from 'react';
import { Column, DataTableProps } from './types';

interface CardViewProps<T> extends DataTableProps<T> {
  getValue: (row: T, column: Column<T>, index: number) => ReactNode;
}

export function CardView<T>({
  data,
  columns,
  rowNumber,
  actions,
  rowKey = 'id' as keyof T,
  onRowClick,
  getValue,
}: CardViewProps<T>) {
  // Primeira coluna é o título principal do card
  const titleColumn = columns[0];
  const otherColumns = columns.slice(1).filter(col => !col.excludeFromCard);

  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div
          key={String(row[rowKey]) || index}
          className={`rounded-lg border border-border glass-panel p-4 ${
            onRowClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''
          }`}
          onClick={() => onRowClick?.(row)}
        >
          {/* Header do card: número + título + ações */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {rowNumber && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {index + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground block truncate">
                  {getValue(row, titleColumn, index)}
                </span>
              </div>
            </div>
            {actions && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {actions(row, index)}
              </div>
            )}
          </div>

          {/* Campos do card em grid 2 colunas */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {otherColumns.map((col) => (
              <div key={String(col.key)} className={col.hideOnMobile ? 'opacity-60' : ''}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block">
                  {col.label}
                </span>
                <span className="text-sm text-foreground">
                  {getValue(row, col, index)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
