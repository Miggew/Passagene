/**
 * Card de estatísticas reprodutivas da receptora - Compacto
 */

import { Activity, Heart, RefreshCw } from 'lucide-react';
import type { Estatisticas } from '@/lib/receptoraHistoricoUtils';

interface ReceptoraEstatisticasCardProps {
  estatisticas: Estatisticas;
}

export function ReceptoraEstatisticasCard({ estatisticas }: ReceptoraEstatisticasCardProps) {
  const taxaSucesso = estatisticas.totalCiclos > 0
    ? ((estatisticas.totalGestacoes / estatisticas.totalCiclos) * 100).toFixed(0)
    : '—';

  const stats = [
    { icon: Activity, label: 'Ciclos', value: estatisticas.totalCiclos, color: 'blue' },
    { icon: Heart, label: 'Gestações', value: estatisticas.totalGestacoes, color: 'emerald' },
    { icon: RefreshCw, label: 'Desde Última', value: estatisticas.ciclosDesdeUltimaGestacao, color: 'amber' },
    { icon: null, label: 'Taxa', value: taxaSucesso !== '—' ? `${taxaSucesso}%` : '—', color: 'primary' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    primary: 'bg-primary/10 text-primary',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${colorClasses[stat.color]} mb-1`}>
              {stat.icon ? (
                <stat.icon className="w-3.5 h-3.5" />
              ) : (
                <span className="text-[10px] font-bold">%</span>
              )}
            </div>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
