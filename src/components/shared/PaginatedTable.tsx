/**
 * Componente de tabela genérica com paginação
 * Reutilizável em todas as listagens do sistema
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface ColumnDef<T> {
  /** Chave única da coluna */
  id: string;
  /** Cabeçalho da coluna */
  header: string | ReactNode;
  /** Função para acessar o valor (ou caminho da propriedade) */
  accessor?: keyof T | ((row: T) => ReactNode);
  /** Renderizador customizado */
  cell?: (row: T, index: number) => ReactNode;
  /** Classes CSS para a coluna */
  className?: string;
  /** Classes CSS para o cabeçalho */
  headerClassName?: string;
}

export interface PaginatedTableProps<T> {
  /** Dados a serem exibidos */
  data: T[];
  /** Definições das colunas */
  columns: ColumnDef<T>[];
  /** Página atual */
  currentPage: number;
  /** Total de páginas */
  totalPages: number;
  /** Função chamada ao mudar página */
  onPageChange: (page: number) => void;
  /** Índice inicial (para mostrar ao usuário) */
  startIndex?: number;
  /** Índice final (para mostrar ao usuário) */
  endIndex?: number;
  /** Total de itens */
  totalItems?: number;
  /** Função para obter a chave única de cada linha */
  rowKey: (row: T, index: number) => string | number;
  /** Renderizador para linha vazia */
  emptyMessage?: string | ReactNode;
  /** Se a tabela está carregando */
  loading?: boolean;
  /** Componente de loading */
  loadingComponent?: ReactNode;
  /** Callback ao clicar em uma linha */
  onRowClick?: (row: T) => void;
  /** Função para determinar se uma linha está selecionada */
  isRowSelected?: (row: T) => boolean;
  /** Classes CSS para linhas selecionadas */
  selectedRowClassName?: string;
  /** Se deve mostrar controles de paginação */
  showPagination?: boolean;
  /** Se deve mostrar info de paginação (Mostrando X-Y de Z) */
  showPaginationInfo?: boolean;
  /** Classe CSS para o container da tabela */
  className?: string;
}

export function PaginatedTable<T>({
  data,
  columns,
  currentPage,
  totalPages,
  onPageChange,
  startIndex = 0,
  endIndex,
  totalItems,
  rowKey,
  emptyMessage = 'Nenhum registro encontrado',
  loading = false,
  loadingComponent,
  onRowClick,
  isRowSelected,
  selectedRowClassName = 'bg-primary-subtle',
  showPagination = true,
  showPaginationInfo = true,
  className = '',
}: PaginatedTableProps<T>) {
  const actualEndIndex = endIndex ?? startIndex + data.length;
  const actualTotalItems = totalItems ?? data.length;

  const getCellValue = (row: T, column: ColumnDef<T>): ReactNode => {
    if (column.cell) {
      return column.cell(row, data.indexOf(row));
    }
    if (column.accessor) {
      if (typeof column.accessor === 'function') {
        return column.accessor(row);
      }
      const value = row[column.accessor];
      if (value === null || value === undefined) return '-';
      return String(value);
    }
    return '-';
  };

  if (loading && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={column.headerClassName}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => {
                const key = rowKey(row, index);
                const selected = isRowSelected?.(row) ?? false;
                const clickable = !!onRowClick;

                return (
                  <TableRow
                    key={key}
                    className={`
                      ${clickable ? 'cursor-pointer hover:bg-muted' : ''}
                      ${selected ? selectedRowClassName : ''}
                    `}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={`${key}-${column.id}`}
                        className={column.className}
                      >
                        {getCellValue(row, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          {showPaginationInfo && (
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1}-{actualEndIndex} de {actualTotalItems}
            </div>
          )}
          {!showPaginationInfo && <div />}

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              title="Primeira página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="px-3 text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginatedTable;
