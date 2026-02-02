/**
 * Componente para seleção de receptoras na transferência de embriões
 * Migrado para usar SelectableDataTable
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { SelectableDataTable, SelectableColumn } from '@/components/shared/DataTable';
import { ReceptoraSincronizada } from '@/lib/types/transferenciaEmbrioes';

interface ReceptorasSelectionProps {
  receptoras: ReceptoraSincronizada[];
  selectedReceptoraId: string;
  contagemSessaoPorReceptora: Record<string, number>;
  submitting: boolean;
  permitirSegundoEmbriao: boolean;
  onSelectReceptora: (receptoraId: string, protocoloReceptoraId: string) => void;
  onDescartarReceptora: () => void;
}

export default function ReceptorasSelection({
  receptoras,
  selectedReceptoraId,
  contagemSessaoPorReceptora,
  submitting,
  permitirSegundoEmbriao,
  onSelectReceptora,
  onDescartarReceptora,
}: ReceptorasSelectionProps) {
  // Filtrar receptoras baseado no modo:
  // - Padrão: esconde receptoras que já receberam 1+ embrião
  // - Com permitirSegundoEmbriao: mostra todas, desabilita as com 2
  const receptorasFiltradas = receptoras.filter(r => {
    const quantidade = contagemSessaoPorReceptora[r.receptora_id] || 0;
    if (permitirSegundoEmbriao) {
      return quantidade < 2; // Mostra quem tem 0 ou 1
    }
    return quantidade === 0; // Só mostra quem não recebeu nenhum
  });
  const columns: SelectableColumn<ReceptoraSincronizada>[] = [
    { key: 'brinco', label: 'Receptora' },
    { key: 'embrioes_count', label: 'Embriões', width: '80px', align: 'center' },
    { key: 'action', label: '', width: '50px', excludeFromCard: true },
  ];

  // Contagem para o footer
  const totalDisponiveis = receptorasFiltradas.length;
  const comEmbriao = receptorasFiltradas.filter(r => (contagemSessaoPorReceptora[r.receptora_id] || 0) > 0).length;

  return (
    <SelectableDataTable<ReceptoraSincronizada>
      data={receptorasFiltradas}
      columns={columns}
      rowKey="receptora_id"
      selectionType="radio"
      radioName="receptora"
      selectedId={selectedReceptoraId}
      onSelect={(id) => {
        const receptora = receptorasFiltradas.find(r => r.receptora_id === id);
        if (receptora) {
          onSelectReceptora(id, receptora.protocolo_receptora_id || '');
        }
      }}
      isRowDisabled={() => false}
      emptyMessage={permitirSegundoEmbriao
        ? "Nenhuma receptora disponível para 2º embrião"
        : "Nenhuma receptora sincronizada encontrada"}
      footerContent={permitirSegundoEmbriao && comEmbriao > 0
        ? `${totalDisponiveis} receptora(s) - ${comEmbriao} com 1 embrião`
        : `${totalDisponiveis} receptora(s) disponível(is)`}
      renderCell={(row, column) => {
        const quantidadeSessao = contagemSessaoPorReceptora[row.receptora_id] || 0;
        const isSelected = selectedReceptoraId === row.receptora_id;

        switch (column.key) {
          case 'brinco':
            return (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{row.brinco}</span>
                  {row.origem === 'CIO_LIVRE' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                      CIO
                    </Badge>
                  )}
                  <CiclandoBadge value={row.ciclando_classificacao} />
                  <QualidadeSemaforo value={row.qualidade_semaforo} />
                </div>
                {row.observacoes && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={row.observacoes}>
                    {row.observacoes}
                  </p>
                )}
              </div>
            );

          case 'embrioes_count':
            // Só mostra o contador quando permitirSegundoEmbriao está ativo
            if (!permitirSegundoEmbriao) {
              return <span className="text-xs text-muted-foreground">-</span>;
            }
            return quantidadeSessao > 0 ? (
              <span className="inline-flex items-center justify-center px-2 h-5 text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded">
                {quantidadeSessao}/2
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">0/2</span>
            );

          case 'action':
            return isSelected ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDescartarReceptora();
                }}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={submitting}
                title="Descartar receptora"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            ) : null;

          default:
            return undefined;
        }
      }}
    />
  );
}
