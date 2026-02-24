/**
 * EditableDataTable - Extensão do DataTable com suporte a edição inline
 *
 * Usado em:
 * - Aspiracoes doadoras (inputs de oócitos, time, text)
 * - ReceptorasTablePasso1 (ciclando, qualidade, observações)
 * - ReceptorasPasso2Table (botões apta/inapta, input motivo)
 */

import { ReactNode, useEffect, useState } from 'react';
import { Column } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export type EditableFieldType = 'text' | 'number' | 'time' | 'custom';

export interface EditableColumn<T> extends Column<T> {
  /** Tipo de campo editável */
  editable?: EditableFieldType;
  /** Placeholder para inputs */
  placeholder?: string;
  /** Se o campo está desabilitado */
  disabled?: boolean | ((row: T, index: number) => boolean);
  /** Classes adicionais para o input */
  inputClassName?: string;
  /** Valor mínimo (para number) */
  min?: number;
  /** Valor máximo (para number) */
  max?: number;
}

export interface EditableDataTableProps<T> {
  /** Array de dados a exibir */
  data: T[];
  /** Definição das colunas */
  columns: EditableColumn<T>[];
  /** Função para renderizar célula customizada (tem prioridade sobre editable) */
  renderCell?: (row: T, column: EditableColumn<T>, index: number) => ReactNode;
  /** Chave única para cada linha (default: 'id') */
  rowKey?: keyof T;
  /** Mensagem quando não há dados */
  emptyMessage?: string;
  /** Classes CSS adicionais para o container */
  className?: string;

  // Edit props
  /** Callback quando valor muda */
  onCellChange?: (rowIndex: number, key: string, value: string | number) => void;
  /** Callback para remover linha */
  onRemoveRow?: (index: number) => void;
  /** Mostrar número da linha */
  rowNumber?: boolean;
  /** Mostrar botão de remover no hover */
  showRemoveButton?: boolean;

  // Layout
  /** Grid columns template (para customização avançada) */
  gridCols?: string;
}

const MOBILE_BREAKPOINT = 768;

export function EditableDataTable<T>({
  data,
  columns,
  renderCell,
  rowKey = 'id' as keyof T,
  emptyMessage = 'Nenhum item encontrado',
  className = '',
  onCellChange,
  onRemoveRow,
  rowNumber = true,
  showRemoveButton = true,
  gridCols,
}: EditableDataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gerar grid-cols automaticamente se não fornecido
  const getGridCols = () => {
    if (gridCols) return gridCols;

    const colWidths = columns.map(col => col.width || '1fr').join('_');
    const prefix = rowNumber ? 'minmax(40px,auto)_' : '';
    const suffix = showRemoveButton ? '_32px' : '';
    return `grid-cols-[${prefix}${colWidths}${suffix}]`;
  };

  // Função para obter valor da célula
  const getValue = (row: T, column: EditableColumn<T>, index: number): ReactNode => {
    // Se tem renderCell customizado, usa ele
    if (renderCell) {
      const custom = renderCell(row, column, index);
      if (custom !== undefined) return custom;
    }

    const key = column.key as keyof T;
    const value = row[key];

    // Se é editável, renderiza input
    if (column.editable && column.editable !== 'custom') {
      const isDisabled = typeof column.disabled === 'function'
        ? column.disabled(row, index)
        : column.disabled ?? false;

      const baseInputClass = "h-7 text-xs";
      const inputClass = `${baseInputClass} ${column.inputClassName || ''}`.trim();

      switch (column.editable) {
        case 'text':
          return (
            <Input
              type="text"
              value={value as string || ''}
              onChange={(e) => onCellChange?.(index, String(key), e.target.value)}
              placeholder={column.placeholder}
              className={`${inputClass} px-2`}
              disabled={isDisabled}
            />
          );

        case 'number':
          return (
            <Input
              type="number"
              min={column.min ?? 0}
              max={column.max}
              value={value as number || ''}
              onChange={(e) => onCellChange?.(index, String(key), parseInt(e.target.value) || 0)}
              placeholder={column.placeholder || '0'}
              className={`${inputClass} text-center px-0`}
              disabled={isDisabled}
            />
          );

        case 'time':
          return (
            <Input
              type="time"
              value={value as string || ''}
              onChange={(e) => onCellChange?.(index, String(key), e.target.value)}
              className={`${inputClass} text-center px-1`}
              disabled={isDisabled}
            />
          );
      }
    }

    // Fallback: valor direto
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  // Desktop: Grid table view
  const renderTable = () => {
    // Construir array de colunas para o template
    const colWidths: string[] = [];
    if (rowNumber) colWidths.push('minmax(40px,auto)');
    columns.forEach(col => colWidths.push(col.width || '1fr'));
    if (showRemoveButton) colWidths.push('32px');

    const gridTemplate = `grid-cols-[${colWidths.join('_')}]`;

    return (
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Cabeçalho */}
        <div className={`grid ${gridTemplate} gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide`}>
          {rowNumber && <div className="px-2 py-2 text-center">#</div>}
          {columns.map((col) => (
            <div
              key={String(col.key)}
              className={`px-2 py-2 ${
                col.align === 'center' ? 'text-center' :
                col.align === 'right' ? 'text-right' : ''
              }`}
            >
              {col.label}
            </div>
          ))}
          {showRemoveButton && <div className="px-2 py-2"></div>}
        </div>

        {/* Linhas */}
        {data.map((row, index) => {
          const id = row[rowKey] ? String(row[rowKey]) : `row-${index}`;

          return (
            <div
              key={id}
              className={`group grid ${gridTemplate} gap-0 items-center border-t border-border hover:bg-muted/50`}
            >
              {rowNumber && (
                <div className="px-2 py-1.5 flex justify-center">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {index + 1}
                  </span>
                </div>
              )}

              {columns.map((col) => (
                <div
                  key={String(col.key)}
                  className={`px-1 py-1 ${
                    col.align === 'center' ? 'text-center' :
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  <div className={`${
                    col.align === 'center' ? 'flex justify-center' :
                    col.align === 'right' ? 'flex justify-end' : ''
                  }`}>
                    {getValue(row, col, index)}
                  </div>
                </div>
              ))}

              {showRemoveButton && (
                <div className="px-1 py-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveRow?.(index)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Remover linha"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Mobile: Card view (edição em forma de formulário)
  const renderCards = () => (
    <div className="space-y-3">
      {data.map((row, index) => {
        const id = row[rowKey] ? String(row[rowKey]) : `row-${index}`;
        const firstCol = columns[0];

        return (
          <div
            key={id}
            className="p-3 rounded-lg border border-border glass-panel"
          >
            {/* Header do card */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                {rowNumber && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {index + 1}
                  </span>
                )}
                <span className="font-medium text-sm text-foreground">
                  {getValue(row, firstCol, index)}
                </span>
              </div>
              {showRemoveButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveRow?.(index)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Remover linha"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Campos editáveis */}
            <div className="grid grid-cols-2 gap-2">
              {columns.slice(1).filter(col => !col.excludeFromCard).map((col) => (
                <div key={String(col.key)} className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">
                    {col.label}
                  </label>
                  <div>
                    {getValue(row, col, index)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {isMobile ? renderCards() : renderTable()}
    </div>
  );
}

export default EditableDataTable;
