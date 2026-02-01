import { ReactNode } from 'react';
import { Column, DataTableProps } from './types';

interface TableViewProps<T> extends DataTableProps<T> {
  getValue: (row: T, column: Column<T>, index: number) => ReactNode;
}

export function TableView<T>({
  data,
  columns,
  rowNumber,
  actions,
  rowKey = 'id' as keyof T,
  onRowClick,
  getValue,
}: TableViewProps<T>) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {rowNumber && (
              <th className="px-2 py-2.5 text-left w-12">#</th>
            )}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-3 py-2.5 ${
                  col.align === 'center' ? 'text-center' :
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
            {actions && (
              <th className="px-2 py-2.5 text-center w-16">Ações</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={String(row[rowKey]) || index}
              className={`border-t border-border hover:bg-muted/50 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onRowClick?.(row)}
            >
              {rowNumber && (
                <td className="px-2 py-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {index + 1}
                  </span>
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className="px-3 py-2"
                >
                  <div className={`${
                    col.align === 'center' ? 'flex justify-center' :
                    col.align === 'right' ? 'flex justify-end' : ''
                  }`}>
                    {getValue(row, col, index)}
                  </div>
                </td>
              ))}
              {actions && (
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  {actions(row, index)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
