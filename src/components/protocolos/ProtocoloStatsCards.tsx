/**
 * Cards de estatísticas do protocolo
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProtocoloStatsCardsProps {
  pendentes: number;
  confirmadas: number;
  descartadas: number;
}

export function ProtocoloStatsCards({
  pendentes,
  confirmadas,
  descartadas,
}: ProtocoloStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">Aguardando</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-slate-900">{pendentes}</p>
        </CardContent>
      </Card>
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-700">Confirmadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">{confirmadas}</p>
        </CardContent>
      </Card>
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-700">Descartadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-red-600">{descartadas}</p>
        </CardContent>
      </Card>
    </div>
  );
}
