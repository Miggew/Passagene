import { ReactNode } from 'react';

export interface Column<T> {
  /** Chave do campo no objeto de dados */
  key: keyof T | string;
  /** Label exibido no cabeçalho */
  label: string;
  /** Largura da coluna (ex: '100px', '2fr', 'auto') */
  width?: string;
  /** Alinhamento do conteúdo */
  align?: 'left' | 'center' | 'right';
  /** Esconder no mobile (ainda aparece no card, mas com menos destaque) */
  hideOnMobile?: boolean;
  /** Não mostrar no card mobile */
  excludeFromCard?: boolean;
}

export interface DataTableProps<T> {
  /** Array de dados a exibir */
  data: T[];
  /** Definição das colunas */
  columns: Column<T>[];
  /** Função para renderizar célula customizada */
  renderCell?: (row: T, column: Column<T>, index: number) => ReactNode;
  /** Callback ao clicar na linha */
  onRowClick?: (row: T) => void;
  /** Mostrar número da linha */
  rowNumber?: boolean;
  /** Mensagem quando não há dados */
  emptyMessage?: string;
  /** Coluna de ações (botões, etc) */
  actions?: (row: T, index: number) => ReactNode;
  /** Chave única para cada linha (default: 'id') */
  rowKey?: keyof T;
  /** Classes CSS adicionais para o container */
  className?: string;
}
