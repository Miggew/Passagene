/**
 * Tabela de embriões do pacote (frescos) para seleção na transferência
 * Migrado para usar SelectableDataTable
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { SelectableDataTable, SelectableColumn } from '@/components/shared/DataTable';
import { EmbrioCompleto, PacoteEmbrioes } from '@/lib/types/transferenciaEmbrioes';

interface EmbrioesTablePacoteProps {
  pacote: PacoteEmbrioes;
  embrioes: EmbrioCompleto[];
  numerosFixosMap: Map<string, number>;
  selectedEmbriaoId: string;
  embrioesPage: number;
  hasD8Limite: boolean;
  onSelectEmbriao: (embriaoId: string) => void;
  onPageChange: (page: number) => void;
}

export default function EmbrioesTablePacote({
  pacote,
  embrioes,
  numerosFixosMap,
  selectedEmbriaoId,
  embrioesPage,
  hasD8Limite,
  onSelectEmbriao,
  onPageChange,
}: EmbrioesTablePacoteProps) {
  // Ordenar embriões
  const embrioesOrdenados = useMemo(() => {
    return [...embrioes].sort((a, b) => {
      const idA = a.identificacao || '';
      const idB = b.identificacao || '';
      if (idA && idB) return idA.localeCompare(idB);
      if (idA && !idB) return -1;
      if (!idA && idB) return 1;
      const numeroA = numerosFixosMap.get(a.id) || 9999;
      const numeroB = numerosFixosMap.get(b.id) || 9999;
      return numeroA - numeroB;
    });
  }, [embrioes, numerosFixosMap]);

  const columns: SelectableColumn<EmbrioCompleto>[] = [
    { key: 'identificacao', label: 'Código', width: '60px', align: 'center' },
    { key: 'doadora_registro', label: 'Doadora' },
    { key: 'touro_nome', label: 'Touro' },
    { key: 'classificacao', label: 'Class.', width: '70px', align: 'center' },
    { key: 'd7_pronto', label: 'Dia', width: '50px', align: 'center' },
  ];

  return (
    <SelectableDataTable<EmbrioCompleto>
      data={embrioesOrdenados}
      columns={columns}
      rowKey="id"
      selectionType="radio"
      radioName="embriao"
      selectedId={selectedEmbriaoId}
      onSelect={onSelectEmbriao}
      pageSize={20}
      currentPage={embrioesPage}
      onPageChange={onPageChange}
      emptyMessage="Nenhum embrião disponível no pacote"
      headerContent={
        hasD8Limite && (
          <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Embriões em D8: transferir ou congelar hoje</span>
          </div>
        )
      }
      footerContent={`${embrioes.length} embrião(ões) disponível(is)`}
      renderCell={(row, column) => {
        switch (column.key) {
          case 'identificacao':
            const numeroFixo = numerosFixosMap.get(row.id) || 0;
            return (
              <span className="text-xs font-medium font-mono text-foreground">
                {row.identificacao || `#${numeroFixo}`}
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

          case 'd7_pronto':
            if (row.d8_limite) {
              return (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  D8
                </Badge>
              );
            }
            if (row.d7_pronto) {
              return (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                  D7
                </Badge>
              );
            }
            return <span className="text-xs text-muted-foreground">-</span>;

          default:
            return undefined;
        }
      }}
    />
  );
}
