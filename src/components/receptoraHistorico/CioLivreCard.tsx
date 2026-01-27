/**
 * Card de status do cio livre
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import type { Receptora } from '@/lib/types';
import { getCioLivreBadgeConfig } from '@/lib/receptoraHistoricoUtils';

interface CioLivreCardProps {
  receptora: Receptora;
  submitting: boolean;
  onRejeitar: () => void;
}

export function CioLivreCard({ receptora, submitting, onRejeitar }: CioLivreCardProps) {
  const badgeConfig = getCioLivreBadgeConfig(receptora.status_cio_livre);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cio Livre</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <p className="text-slate-500">Status</p>
          <Badge variant="outline" className={badgeConfig.className}>
            {badgeConfig.label}
          </Badge>
        </div>
        {receptora.status_cio_livre === 'PENDENTE' && (
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onRejeitar}
              disabled={submitting}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar Cio Livre
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
