/**
 * Card de histórico administrativo (cadastro e mudanças de fazenda) - Compacto
 */

import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import type { HistoricoAdmin } from '@/lib/receptoraHistoricoUtils';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';

interface ReceptoraAdminHistoricoCardProps {
  historicoAdmin: HistoricoAdmin[];
}

export function ReceptoraAdminHistoricoCard({ historicoAdmin }: ReceptoraAdminHistoricoCardProps) {
  if (historicoAdmin.length === 0) return null;

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

  return (
    <div className="rounded-lg border border-border glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Histórico Administrativo</span>
      </div>

      {/* Itens */}
      <div className="divide-y divide-border/50">
        {historicoAdmin.map((item, index) => (
          <div key={index} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-muted/50">
              {getTipoIcon(item.tipo)}
            </div>
            {getTipoBadge(item.tipo)}
            <span className="flex-1 text-xs text-foreground truncate">{item.resumo}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatDateBR(item.data)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
