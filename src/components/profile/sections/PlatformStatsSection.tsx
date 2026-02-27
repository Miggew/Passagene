/**
 * Stats agregadas da plataforma PassaGene (admin only).
 */
import { Users, Building2, Dna, FlaskConical, Syringe, TrendingUp } from 'lucide-react';
import { usePlatformStats } from '@/hooks/useFazendaProfile';
import type { PlatformStatsContent } from '@/lib/types';

interface PlatformStatsSectionProps {
  content: PlatformStatsContent;
}

const METRICS = [
  { key: 'total_clientes', label: 'Clientes', icon: Users, color: 'text-violet-500' },
  { key: 'total_fazendas', label: 'Fazendas', icon: Building2, color: 'text-amber-500' },
  { key: 'total_embrioes', label: 'Embriões', icon: Dna, color: 'text-primary-500' },
  { key: 'total_aspiracoes', label: 'Aspirações', icon: FlaskConical, color: 'text-blue-500' },
  { key: 'total_tes', label: 'Transferências', icon: Syringe, color: 'text-pink-500' },
  { key: 'taxa_prenhez', label: 'Taxa Prenhez', icon: TrendingUp, color: 'text-emerald-500', suffix: '%' },
] as const;

export default function PlatformStatsSection({ content }: PlatformStatsSectionProps) {
  const { data: stats, isLoading } = usePlatformStats();
  const visibility = content.visibility || {};

  const visibleMetrics = METRICS.filter(m => visibility[m.key] !== false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats || visibleMetrics.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem estatísticas disponíveis.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visibleMetrics.map(m => {
        const Icon = m.icon;
        const value = stats[m.key as keyof typeof stats];
        const suffix = 'suffix' in m ? m.suffix : '';
        return (
          <div key={m.key} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="flex justify-center mb-1">
              <Icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <p className="text-lg font-extrabold text-foreground">
              {value != null ? `${value}${suffix}` : '--'}
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {m.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
