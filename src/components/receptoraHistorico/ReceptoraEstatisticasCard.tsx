/**
 * Card de estatísticas reprodutivas da receptora
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Estatisticas } from '@/lib/receptoraHistoricoUtils';

interface ReceptoraEstatisticasCardProps {
  estatisticas: Estatisticas;
}

export function ReceptoraEstatisticasCard({ estatisticas }: ReceptoraEstatisticasCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estatísticas Reprodutivas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{estatisticas.totalCiclos}</p>
            <p className="text-sm text-slate-600 mt-1">Ciclos Realizados</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-2xl font-bold text-green-700">{estatisticas.totalGestacoes}</p>
            <p className="text-sm text-slate-600 mt-1">Gestações</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-2xl font-bold text-orange-700">{estatisticas.ciclosDesdeUltimaGestacao}</p>
            <p className="text-sm text-slate-600 mt-1">Ciclos desde Última Gestação</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
