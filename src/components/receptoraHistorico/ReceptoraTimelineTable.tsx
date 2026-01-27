/**
 * Tabela de linha do tempo reprodutiva
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import type { HistoricoItem } from '@/lib/receptoraHistoricoUtils';
import { formatarData, tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';

interface ReceptoraTimelineTableProps {
  historico: HistoricoItem[];
}

export function ReceptoraTimelineTable({ historico }: ReceptoraTimelineTableProps) {
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
        <CardTitle className="text-base">
          Linha do Tempo Reprodutiva ({historico.length} eventos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <EmptyState
            title="Nenhum evento registrado"
            description="Quando houver eventos, eles aparecerão aqui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((item, index) => (
                <TableRow key={index} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-sm">
                    {formatarData(item.data)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTipoIcon(item.tipo)}
                      {getTipoBadge(item.tipo)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{item.resumo}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
