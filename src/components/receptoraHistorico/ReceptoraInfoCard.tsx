/**
 * Card de informações básicas da receptora - Compacto
 */

import { CowIcon } from '@/components/icons/CowIcon';
import StatusBadge from '@/components/shared/StatusBadge';
import type { Receptora } from '@/lib/types';

interface ReceptoraInfoCardProps {
  receptora: Receptora;
}

export function ReceptoraInfoCard({ receptora }: ReceptoraInfoCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
          <CowIcon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{receptora.identificacao}</span>
            {receptora.nome && (
              <span className="text-sm text-muted-foreground">• {receptora.nome}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {receptora.raca && <span>{receptora.raca}</span>}
          </div>
        </div>
        <StatusBadge status={receptora.status_reprodutivo || 'VAZIA'} />
      </div>
    </div>
  );
}
