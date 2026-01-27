/**
 * Card de histórico administrativo (cadastro e mudanças de fazenda)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, UserPlus } from 'lucide-react';
import type { HistoricoAdmin } from '@/lib/receptoraHistoricoUtils';
import { formatarData, tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';

interface ReceptoraAdminHistoricoCardProps {
  historicoAdmin: HistoricoAdmin[];
}

export function ReceptoraAdminHistoricoCard({ historicoAdmin }: ReceptoraAdminHistoricoCardProps) {
  if (historicoAdmin.length === 0) return null;

  const getTipoIcon = (tipo: string) => {
    const config = tipoIconConfig[tipo];
    if (!config) return <Calendar className="w-4 h-4" />;
    const Icon = config.icon;
    return <Icon className={config.className} />;
  };

  const getTipoBadge = (tipo: string) => {
    const config = tipoBadgeConfig[tipo];
    if (!config) return <Badge variant="outline">{tipo}</Badge>;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico Administrativo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {historicoAdmin.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-center gap-2 min-w-[100px]">
                {getTipoIcon(item.tipo)}
                {getTipoBadge(item.tipo)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{item.resumo}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatarData(item.data)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
