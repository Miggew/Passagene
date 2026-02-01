import { ReactNode, useEffect, useState } from 'react';
import { Column, DataTableProps } from './types';
import { TableView } from './TableView';
import { CardView } from './CardView';

// Re-export types
export type { Column, DataTableProps } from './types';

// Re-export extensions
export { SelectableDataTable } from './SelectableDataTable';
export type { SelectableColumn, SelectableDataTableProps } from './SelectableDataTable';

export { EditableDataTable } from './EditableDataTable';
export type { EditableColumn, EditableDataTableProps, EditableFieldType } from './EditableDataTable';

const MOBILE_BREAKPOINT = 768;

export function DataTable<T>({
  data,
  columns,
  renderCell,
  onRowClick,
  rowNumber = false,
  emptyMessage = 'Nenhum item encontrado',
  actions,
  rowKey = 'id' as keyof T,
  className = '',
}: DataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check initial
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Função para obter o valor de uma célula
  const getValue = (row: T, column: Column<T>, index: number): ReactNode => {
    // Se tem renderCell customizado, usa ele
    if (renderCell) {
      const custom = renderCell(row, column, index);
      if (custom !== undefined) return custom;
    }

    // Fallback: valor direto do objeto
    const value = row[column.key as keyof T];
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  const commonProps = {
    data,
    columns,
    rowNumber,
    actions,
    rowKey,
    onRowClick,
    getValue,
    renderCell,
    emptyMessage,
  };

  return (
    <div className={className}>
      {isMobile ? (
        <CardView {...commonProps} />
      ) : (
        <TableView {...commonProps} />
      )}
    </div>
  );
}

export default DataTable;
