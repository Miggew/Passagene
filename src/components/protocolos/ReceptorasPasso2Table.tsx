/**
 * Tabela de receptoras para revisão no 2º passo
 * Layout baseado na ReceptorasTablePasso1 + colunas de avaliação
 */

import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { cn } from '@/lib/utils';

interface ReceptoraPasso2 {
  id: string;
  identificacao: string;
  nome?: string | null;
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
  pr_observacoes?: string;
  historicoStats?: {
    totalProtocolos: number;
    gestacoes: number;
    protocolosDesdeUltimaGestacao: number;
  };
}

interface ReceptorasPasso2TableProps {
  receptoras: ReceptoraPasso2[];
  motivosInapta: Record<string, string>;
  isFinalized: boolean;
  onStatusChange: (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => void;
  onMotivoChange: (receptoraId: string, motivo: string) => void;
  /** Se true, renderiza apenas a tabela sem Card wrapper */
  hideCard?: boolean;
}

export function ReceptorasPasso2Table({
  receptoras,
  motivosInapta,
  isFinalized,
  onStatusChange,
  onMotivoChange,
  hideCard = false,
}: ReceptorasPasso2TableProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'INICIADA': {
        label: 'Pendente',
        className: 'bg-muted text-muted-foreground border-border',
      },
      'APTA': {
        label: 'Apta',
        className: 'bg-primary/15 text-primary border-primary/30',
      },
      'INAPTA': {
        label: 'Inapta',
        className: 'bg-destructive/15 text-destructive border-destructive/30',
      },
    };

    const config = statusMap[status] || { label: status, className: '' };
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Conteúdo da tabela (reutilizado em ambos os modos)
  const tableContent = receptoras.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground">
      Nenhuma receptora no protocolo
    </div>
  ) : (
    /* Container com scroll horizontal quando necessário */
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* Tabela: min-w garante largura mínima, w-full distribui uniformemente */}
      <div className="min-w-[750px] w-full">
        {/* Cabeçalho - colunas fixas + flexíveis com minmax + separador de contexto */}
        <div className="grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_80px_80px_70px_minmax(120px,1fr)] gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="px-3 py-2">Receptora</div>
          <div className="px-1 py-2 text-center" title="Protocolos">P</div>
          <div className="px-1 py-2 text-center" title="Gestações">G</div>
          <div className="px-1 py-2 text-center" title="Desde última">D</div>
          <div className="border-r border-border/50"></div>
          <div className="px-2 py-2 text-center">Ciclando</div>
          <div className="px-2 py-2 text-center">Qualidade</div>
          <div className="px-2 py-2 text-center">Avaliação</div>
          <div className="px-2 py-2">Motivo</div>
        </div>

        {/* Linhas */}
        {receptoras.map((r, index) => {
          const stats = r.historicoStats;

          return (
            <div
              key={r.id}
              className="group grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_80px_80px_70px_minmax(120px,1fr)] gap-0 items-center border-t border-border hover:bg-muted/50"
            >
            {/* Receptora */}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                {index + 1}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm text-foreground truncate">{r.identificacao}</span>
                {r.nome && <span className="text-[10px] text-muted-foreground truncate">{r.nome}</span>}
              </div>
            </div>

            {/* Histórico P G D */}
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-muted text-foreground rounded">
                {stats?.totalProtocolos ?? 0}
              </span>
            </div>
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-primary/15 text-primary rounded">
                {stats?.gestacoes ?? 0}
              </span>
            </div>
            <div className="px-1 py-1.5 text-center">
              <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded">
                {stats?.protocolosDesdeUltimaGestacao ?? 0}
              </span>
            </div>

            {/* Separador de contexto */}
            <div className="border-r border-border/50 h-full"></div>

            {/* Ciclando (display only) */}
            <div className="px-2 py-1 flex justify-center">
              <CiclandoBadge
                value={r.pr_ciclando_classificacao}
                variant="display"
                disabled={true}
              />
            </div>

            {/* Qualidade (display only) */}
            <div className="px-2 py-1 flex justify-center">
              <QualidadeSemaforo
                value={r.pr_qualidade_semaforo}
                variant="single"
                disabled={true}
              />
            </div>

            {/* Avaliação */}
            <div className="px-2 py-1 flex justify-center">
              {!isFinalized ? (
                <div className="flex items-center gap-1">
                  {/* Botão Confirmar (APTA) - maior, ação principal */}
                  <button
                    type="button"
                    onClick={() => onStatusChange(r.id, r.pr_status === 'APTA' ? 'INICIADA' : 'APTA')}
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center transition-all",
                      r.pr_status === 'APTA'
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary"
                    )}
                    title="Confirmar (Apta)"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  {/* Botão Rejeitar (INAPTA) - menor, ação secundária */}
                  <button
                    type="button"
                    onClick={() => onStatusChange(r.id, r.pr_status === 'INAPTA' ? 'INICIADA' : 'INAPTA')}
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                      r.pr_status === 'INAPTA'
                        ? "bg-destructive text-destructive-foreground shadow-sm"
                        : "bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    )}
                    title="Rejeitar (Inapta)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                getStatusBadge(r.pr_status)
              )}
            </div>

            {/* Motivo (se INAPTA) */}
            <div className="px-2 py-1">
              {r.pr_status === 'INAPTA' && !isFinalized ? (
                <Input
                  type="text"
                  placeholder="Motivo..."
                  value={motivosInapta[r.id] || r.pr_motivo_inapta || ''}
                  onChange={(e) => onMotivoChange(r.id, e.target.value)}
                  className="h-6 text-xs px-2"
                />
              ) : (
                <span className="text-xs text-muted-foreground truncate block">
                  {r.pr_motivo_inapta || '-'}
                </span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );

  // Se hideCard, retorna apenas o conteúdo da tabela
  if (hideCard) {
    return tableContent;
  }

  // Se não, envolve em Card (comportamento padrão para compatibilidade)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Receptoras para Revisão ({receptoras.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {tableContent}
      </CardContent>
    </Card>
  );
}
