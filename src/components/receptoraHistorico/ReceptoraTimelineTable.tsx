/**
 * Tabela de linha do tempo reprodutiva - Compacto
 */

import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import type { HistoricoItem } from '@/lib/receptoraHistoricoUtils';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';

interface ReceptoraTimelineTableProps {
  historico: HistoricoItem[];
}

export function ReceptoraTimelineTable({ historico }: ReceptoraTimelineTableProps) {
  const getTipoIcon = (tipo: string) => {
    const config = tipoIconConfig[tipo];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="w-3 h-3" />;
  };

  const getTipoBadge = (tipo: string) => {
    const config = tipoBadgeConfig[tipo];
    if (!config) return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tipo}</Badge>;
    return (
      <Badge variant="outline" className={`${config.className} text-[10px] px-1.5 py-0`}>
        {config.label}
      </Badge>
    );
  };

  if (historico.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Linha do Tempo</span>
        </div>
        <EmptyState
          title="Nenhum evento"
          description="Eventos reprodutivos aparecerão aqui."
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Linha do Tempo</span>
        </div>
        <span className="text-xs text-muted-foreground">{historico.length} eventos</span>
      </div>

      {/* Linhas */}
      <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
        {historico.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            {/* Data */}
            <span className="text-xs font-medium text-muted-foreground w-[70px] shrink-0">
              {formatDateBR(item.data)}
            </span>

            {/* Tipo */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center justify-center w-5 h-5 rounded bg-muted/50">
                {getTipoIcon(item.tipo)}
              </div>
              {getTipoBadge(item.tipo)}
            </div>

            {/* Resumo */}
            <div className="flex-1 min-w-0">
              <span className="text-xs text-foreground truncate block">{item.resumo}</span>
              {item.detalhes && (
                <span className="text-[10px] text-muted-foreground truncate block">{item.detalhes}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
