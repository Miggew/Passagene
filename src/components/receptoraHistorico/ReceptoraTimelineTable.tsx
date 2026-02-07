/**
 * Tabela de linha do tempo reprodutiva - Cards expansíveis
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { History, ChevronDown } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import type { HistoricoItem } from '@/lib/receptoraHistoricoUtils';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface ReceptoraTimelineTableProps {
  historico: HistoricoItem[];
}

export function ReceptoraTimelineTable({ historico }: ReceptoraTimelineTableProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getTipoIcon = (tipo: string) => {
    const config = tipoIconConfig[tipo];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="w-3.5 h-3.5" />;
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

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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

      {/* Cards expansíveis */}
      <div className="divide-y divide-border/50 max-h-[350px] overflow-y-auto">
        {historico.map((item, index) => {
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={index}
              onClick={() => toggleExpand(index)}
              className={cn(
                'px-3 py-2.5 transition-all duration-200 cursor-pointer hover:bg-muted/30',
                isExpanded && 'bg-muted/20'
              )}
            >
              {/* Linha principal - sempre visível */}
              <div className="flex items-center gap-3">
                {/* Data */}
                <span className="text-xs font-medium text-muted-foreground w-[70px] shrink-0">
                  {formatDateBR(item.data)}
                </span>

                {/* Tipo com ícone */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
                    isExpanded ? 'bg-primary/15' : 'bg-muted/50'
                  )}>
                    <span className={isExpanded ? 'text-primary' : 'text-muted-foreground'}>
                      {getTipoIcon(item.tipo)}
                    </span>
                  </div>
                  {getTipoBadge(item.tipo)}
                </div>

                {/* Resumo compacto ou expandido */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    'text-xs text-foreground',
                    !isExpanded && 'truncate block'
                  )}>
                    {item.resumo}
                  </span>
                </div>

                {/* Indicador de expansão */}
                <ChevronDown className={cn(
                  'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )} />
              </div>

              {/* Conteúdo expandido - detalhes completos */}
              {isExpanded && item.detalhes && (
                <div className="mt-2 ml-[82px] pl-3 border-l-2 border-primary/30">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.detalhes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
