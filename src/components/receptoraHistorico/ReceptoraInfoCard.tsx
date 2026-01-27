/**
 * Card de informações básicas da receptora
 */

import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import type { Receptora } from '@/lib/types';

interface ReceptoraInfoCardProps {
  receptora: Receptora;
}

export function ReceptoraInfoCard({ receptora }: ReceptoraInfoCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Brinco</p>
            <p className="font-medium">{receptora.identificacao}</p>
          </div>
          <div>
            <p className="text-slate-500">Nome</p>
            <p className="font-medium">{receptora.nome || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Status Atual</p>
            <StatusBadge status={receptora.status_reprodutivo || 'VAZIA'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
