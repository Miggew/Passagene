/**
 * Dialog para exibir relatório de transferências de embriões da sessão
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 *
 * Agrupa transferências por receptora para evitar confusão quando
 * uma receptora recebe 2 embriões
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import { formatDateBR as formatDate } from '@/lib/dateUtils';
import { RelatorioTransferenciaItem } from '@/lib/types/transferenciaEmbrioes';

interface RelatorioTransferenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatorioData: RelatorioTransferenciaItem[];
  fazendaNome: string;
  dataTe: string;
  veterinarioResponsavel: string;
  tecnicoResponsavel: string;
  isVisualizacaoApenas: boolean;
  submitting: boolean;
  onFechar: () => void;
  onConfirmarEncerrar: () => Promise<void>;
}

// Interface para receptora agrupada
interface ReceptoraAgrupada {
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome: string;
  embrioes: RelatorioTransferenciaItem[];
  observacoes: string[];
}

export default function RelatorioTransferenciaDialog({
  open,
  onOpenChange,
  relatorioData,
  fazendaNome,
  dataTe,
  veterinarioResponsavel,
  tecnicoResponsavel,
  isVisualizacaoApenas,
  submitting,
  onFechar,
  onConfirmarEncerrar,
}: RelatorioTransferenciaDialogProps) {
  // Agrupar transferências por receptora
  const receptorasAgrupadas = useMemo(() => {
    const grupos = new Map<string, ReceptoraAgrupada>();

    relatorioData.forEach(item => {
      const key = item.receptora_id || item.receptora_brinco;

      if (!grupos.has(key)) {
        grupos.set(key, {
          receptora_id: item.receptora_id || '',
          receptora_brinco: item.receptora_brinco,
          receptora_nome: item.receptora_nome || '',
          embrioes: [],
          observacoes: [],
        });
      }

      const grupo = grupos.get(key)!;
      grupo.embrioes.push(item);
      if (item.observacoes) {
        grupo.observacoes.push(item.observacoes);
      }
    });

    return Array.from(grupos.values());
  }, [relatorioData]);

  const totalReceptoras = receptorasAgrupadas.length;
  const totalEmbrioes = relatorioData.length;
  const receptorasComDuplo = receptorasAgrupadas.filter(r => r.embrioes.length >= 2).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Relatório da Sessão de Transferência de Embriões
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>Fazenda: {fazendaNome || 'N/A'}</span>
            <span className="text-muted-foreground">•</span>
            <span>Data da TE: {dataTe ? formatDate(dataTe) : 'N/A'}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-medium text-foreground">
              {totalReceptoras} receptora{totalReceptoras !== 1 ? 's' : ''} • {totalEmbrioes} embrião{totalEmbrioes !== 1 ? 'es' : ''}
            </span>
            {receptorasComDuplo > 0 && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                {receptorasComDuplo} com 2 embriões
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Veterinário Responsável:</strong> {veterinarioResponsavel || 'N/A'}</div>
            <div><strong>Técnico Responsável:</strong> {tecnicoResponsavel || 'N/A'}</div>
          </div>

          {/* Tabela agrupada por receptora */}
          <div className="rounded-xl border border-border glass-panel overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
              <div className="grid grid-cols-[1.5fr_3fr_1.5fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-primary/40" />
                  Receptora
                </div>
                <div className="px-3 py-3">Embriões Transferidos</div>
                <div className="px-3 py-3">Observações</div>
              </div>
            </div>

            {/* Linhas */}
            <div className="divide-y divide-border/50">
              {receptorasAgrupadas.map((receptora, index) => {
                const temDuplo = receptora.embrioes.length >= 2;

                return (
                  <div
                    key={receptora.receptora_id || index}
                    className={`
                      grid grid-cols-[1.5fr_3fr_1.5fr] items-start
                      ${temDuplo ? 'bg-amber-500/5' : ''}
                    `}
                  >
                    {/* Coluna Receptora */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {receptora.receptora_brinco}
                        </span>
                        {temDuplo && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-600 border-amber-500/30">
                            2 embriões
                          </Badge>
                        )}
                      </div>
                      {receptora.receptora_nome && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {receptora.receptora_nome}
                        </p>
                      )}
                    </div>

                    {/* Coluna Embriões */}
                    <div className="px-3 py-3">
                      <div className="space-y-1.5">
                        {receptora.embrioes.map((embriao, embIndex) => (
                          <div
                            key={embIndex}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-semibold bg-primary/10 text-primary rounded">
                              {embriao.numero_embriao}
                            </span>
                            <span className="text-muted-foreground">
                              {embriao.doadora || 'N/A'} × {embriao.touro || 'N/A'}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {embriao.classificacao || '-'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coluna Observações */}
                    <div className="px-3 py-3">
                      {receptora.observacoes.length > 0 ? (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {receptora.observacoes.map((obs, obsIndex) => (
                            <li key={obsIndex}>{obs}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer com resumo */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{totalReceptoras}</span> receptora{totalReceptoras !== 1 ? 's' : ''} •{' '}
                <span className="font-medium text-foreground">{totalEmbrioes}</span> embrião{totalEmbrioes !== 1 ? 'es' : ''}
              </span>
              {receptorasComDuplo > 0 && (
                <span className="text-xs text-amber-600">
                  {receptorasComDuplo} receptora{receptorasComDuplo !== 1 ? 's' : ''} com transferência dupla
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onFechar}
          >
            Fechar
          </Button>
          {!isVisualizacaoApenas && (
            <Button
              type="button"
              onClick={async () => {
                onFechar();
                await onConfirmarEncerrar();
              }}
              disabled={submitting}
            >
              {submitting ? 'Encerrando...' : 'Confirmar e Encerrar Sessão'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
