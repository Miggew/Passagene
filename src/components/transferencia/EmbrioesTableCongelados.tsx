/**
 * Tabela de embriões congelados para seleção na transferência
 * Migrado para usar SelectableDataTable
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { SelectableDataTable, SelectableColumn } from '@/components/shared/DataTable';
import { EmbrioCompleto } from '@/lib/types/transferenciaEmbrioes';

interface EmbrioesTableCongeladosProps {
  embrioes: EmbrioCompleto[];
  selectedEmbriaoId: string;
  embrioesPage: number;
  loadingCongelados: boolean;
  filtroClienteId: string;
  filtroRaca: string;
  onSelectEmbriao: (embriaoId: string) => void;
  onPageChange: (page: number) => void;
}

export default function EmbrioesTableCongelados({
  embrioes,
  selectedEmbriaoId,
  embrioesPage,
  loadingCongelados,
  filtroClienteId,
  filtroRaca,
  onSelectEmbriao,
  onPageChange,
}: EmbrioesTableCongeladosProps) {
  const temFiltro = filtroClienteId || filtroRaca.trim();

  // Ordenar por data de criação
  const ordenados = useMemo(() => {
    return [...embrioes].sort((a, b) => {
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dataB - dataA;
    });
  }, [embrioes]);

  const columns: SelectableColumn<EmbrioCompleto>[] = [
    { key: 'identificacao', label: 'Código', width: '80px' },
    { key: 'doadora_registro', label: 'Doadora' },
    { key: 'touro_nome', label: 'Touro' },
    { key: 'classificacao', label: 'Class.', width: '70px', align: 'center' },
  ];

  // Mensagem de estado vazio customizada
  const getEmptyMessage = () => {
    if (!temFiltro) {
      return 'Selecione um cliente ou informe a raça para listar embriões';
    }
    if (loadingCongelados) {
      return 'Carregando embriões congelados...';
    }
    return 'Nenhum embrião congelado encontrado';
  };

  // Se não tem filtro ou está carregando, mostra mensagem especial
  if (!temFiltro || loadingCongelados) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center border border-border rounded-lg">
          <div className="text-center py-6 text-sm text-muted-foreground">
            {getEmptyMessage()}
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {embrioes.length} embrião(ões) disponível(is)
        </div>
      </div>
    );
  }

  return (
    <SelectableDataTable<EmbrioCompleto>
      data={ordenados}
      columns={columns}
      rowKey="id"
      selectionType="radio"
      radioName="embriao"
      selectedId={selectedEmbriaoId}
      onSelect={onSelectEmbriao}
      pageSize={20}
      currentPage={embrioesPage}
      onPageChange={onPageChange}
      emptyMessage={getEmptyMessage()}
      footerContent={`${embrioes.length} embrião(ões) disponível(is)`}
      renderCell={(row, column) => {
        switch (column.key) {
          case 'identificacao':
            return (
              <span className="text-xs font-medium font-mono text-foreground">
                {row.identificacao || row.id.substring(0, 8)}
              </span>
            );

          case 'doadora_registro':
            return (
              <span className="text-sm text-foreground truncate">
                {row.doadora_registro || '-'}
              </span>
            );

          case 'touro_nome':
            return (
              <span className="text-sm text-muted-foreground truncate">
                {row.touro_nome || '-'}
              </span>
            );

          case 'classificacao':
            return row.classificacao ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {row.classificacao}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            );

          default:
            return undefined;
        }
      }}
    />
  );
}
