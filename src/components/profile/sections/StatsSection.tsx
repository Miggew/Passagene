import { Dna, Baby, Heart } from 'lucide-react';
import type { StatsSectionContent } from '@/lib/types';

interface StatsSectionProps {
  content: StatsSectionContent;
}

export default function StatsSection({ content }: StatsSectionProps) {
  const stats: Array<{ label: string; value: string; icon?: React.ReactNode }> = [];

  if (content.show_doadoras) {
    stats.push({ label: 'Doadoras', value: '--', icon: <Heart className="w-4 h-4 text-pink-500" /> });
  }
  if (content.show_receptoras) {
    stats.push({ label: 'Receptoras', value: '--', icon: <Baby className="w-4 h-4 text-violet-500" /> });
  }
  if (content.show_embrioes) {
    stats.push({ label: 'Embriões', value: '--', icon: <Dna className="w-4 h-4 text-primary-500" /> });
  }

  if (content.custom_stats) {
    for (const cs of content.custom_stats) {
      stats.push({ label: cs.label, value: cs.value });
    }
  }

  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma estatística configurada.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          {stat.icon && <div className="flex justify-center mb-1">{stat.icon}</div>}
          <p className="text-lg font-extrabold text-foreground">{stat.value}</p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
