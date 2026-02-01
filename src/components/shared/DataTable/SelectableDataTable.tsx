/**
 * SelectableDataTable - Extensão do DataTable com suporte a seleção (radio/checkbox)
 *
 * Usado em:
 * - EmbrioesTablePacote (seleção única - radio)
 * - EmbrioesTableCongelados (seleção única - radio)
 * - ReceptorasSelection (seleção única - radio)
 */

import { ReactNode, useEffect, useState } from 'react';
import { Column } from './types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SelectableColumn<T> extends Column<T> {
  /** Se a coluna deve ser renderizada de forma compacta */
  compact?: boolean;
}

export interface SelectableDataTableProps<T> {
  /** Array de dados a exibir */
  data: T[];
  /** Definição das colunas */
  columns: SelectableColumn<T>[];
  /** Função para renderizar célula customizada */
  renderCell?: (row: T, column: SelectableColumn<T>, index: number) => ReactNode;
  /** Chave única para cada linha (default: 'id') */
  rowKey?: keyof T;
  /** Mensagem quando não há dados */
  emptyMessage?: string;
  /** Classes CSS adicionais para o container */
  className?: string;

  // Selection props
  /** Tipo de seleção: 'radio' (única) ou 'checkbox' (múltipla) */
  selectionType?: 'radio' | 'checkbox';
  /** ID do item selecionado (para radio) */
  selectedId?: string;
  /** IDs dos itens selecionados (para checkbox) */
  selectedIds?: string[];
  /** Callback quando seleção muda (radio) */
  onSelect?: (id: string) => void;
  /** Callback quando seleção muda (checkbox) */
  onSelectMultiple?: (ids: string[]) => void;
  /** Função para determinar se uma linha está desabilitada */
  isRowDisabled?: (row: T) => boolean;
  /** Nome do grupo de radio buttons */
  radioName?: string;

  // Pagination props
  /** Número de itens por página (0 = sem paginação) */
  pageSize?: number;
  /** Página atual (controlada externamente) */
  currentPage?: number;
  /** Callback quando página muda */
  onPageChange?: (page: number) => void;

  // Header content
  /** Conteúdo adicional no cabeçalho (ex: avisos) */
  headerContent?: ReactNode;
  /** Conteúdo adicional no rodapé (ex: contagem) */
  footerContent?: ReactNode;
}

const MOBILE_BREAKPOINT = 768;

export function SelectableDataTable<T>({
  data,
  columns,
  renderCell,
  rowKey = 'id' as keyof T,
  emptyMessage = 'Nenhum item encontrado',
  className = '',
  selectionType = 'radio',
  selectedId = '',
  selectedIds = [],
  onSelect,
  onSelectMultiple,
  isRowDisabled,
  radioName = 'selection',
  pageSize = 0,
  currentPage: externalPage,
  onPageChange,
  headerContent,
  footerContent,
}: SelectableDataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);
  const [internalPage, setInternalPage] = useState(1);

  const currentPage = externalPage ?? internalPage;
  const setCurrentPage = onPageChange ?? setInternalPage;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Função para obter o valor de uma célula
  const getValue = (row: T, column: SelectableColumn<T>, index: number): ReactNode => {
    if (renderCell) {
      const custom = renderCell(row, column, index);
      if (custom !== undefined) return custom;
    }
    const value = row[column.key as keyof T];
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  // Paginação
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const paginatedData = pageSize > 0
    ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : data;

  // Handlers de seleção
  const handleSelect = (row: T) => {
    const id = String(row[rowKey]);
    if (isRowDisabled?.(row)) return;

    if (selectionType === 'radio') {
      onSelect?.(id);
    } else {
      const newIds = selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id];
      onSelectMultiple?.(newIds);
    }
  };

  const isSelected = (row: T): boolean => {
    const id = String(row[rowKey]);
    return selectionType === 'radio' ? selectedId === id : selectedIds.includes(id);
  };

  // Desktop: Table view
  const renderTable = () => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <th className="w-8 px-2 py-2"></th>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-2 py-2 font-semibold ${
                  col.align === 'center' ? 'text-center' :
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, index) => {
            const id = String(row[rowKey]);
            const disabled = isRowDisabled?.(row) ?? false;
            const selected = isSelected(row);

            return (
              <tr
                key={id}
                className={`border-t border-border transition-colors ${
                  selected ? 'bg-primary/10' :
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer'
                }`}
                onClick={() => handleSelect(row)}
              >
                <td className="px-2 py-2">
                  <div className="flex justify-center">
                    <input
                      type={selectionType}
                      name={selectionType === 'radio' ? radioName : undefined}
                      checked={selected}
                      onChange={() => handleSelect(row)}
                      disabled={disabled}
                      className="w-4 h-4 accent-primary"
                    />
                  </div>
                </td>
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-2 py-2 ${
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
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Mobile: Card view
  const renderCards = () => (
    <div className="space-y-2">
      {paginatedData.map((row, index) => {
        const id = String(row[rowKey]);
        const disabled = isRowDisabled?.(row) ?? false;
        const selected = isSelected(row);
        const firstCol = columns[0];

        return (
          <div
            key={id}
            className={`p-3 rounded-lg border transition-colors ${
              selected ? 'border-primary bg-primary/5' :
              disabled ? 'border-border opacity-50' : 'border-border hover:border-primary/50'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => handleSelect(row)}
          >
            <div className="flex items-start gap-3">
              <input
                type={selectionType}
                name={selectionType === 'radio' ? radioName : undefined}
                checked={selected}
                onChange={() => handleSelect(row)}
                disabled={disabled}
                className="w-4 h-4 accent-primary mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  {getValue(row, firstCol, index)}
                </div>
                <div className="mt-1 space-y-1">
                  {columns.slice(1).filter(col => !col.excludeFromCard).map((col) => (
                    <div key={String(col.key)} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{col.label}:</span>
                      <span className="text-foreground">{getValue(row, col, index)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Paginação component
  const renderPagination = () => {
    if (pageSize <= 0 || totalPages <= 1) return null;

    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-3 h-3 mr-1" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Próxima
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header content (avisos, etc) */}
      {headerContent}

      {/* Empty state ou tabela */}
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isMobile ? renderCards() : renderTable()}
        </div>
      )}

      {/* Footer com paginação */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div>{footerContent ?? `${data.length} item(s)`}</div>
        {renderPagination()}
      </div>
    </div>
  );
}

export default SelectableDataTable;
