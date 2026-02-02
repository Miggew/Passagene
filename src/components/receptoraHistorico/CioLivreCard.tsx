/**
 * Card de status do cio livre - Compacto
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, XCircle, AlertCircle } from 'lucide-react';
import type { Receptora } from '@/lib/types';
import { getCioLivreBadgeConfig } from '@/lib/receptoraHistoricoUtils';

interface CioLivreCardProps {
  receptora: Receptora;
  submitting: boolean;
  onRejeitar: () => void;
}

export function CioLivreCard({ receptora, submitting, onRejeitar }: CioLivreCardProps) {
  const badgeConfig = getCioLivreBadgeConfig(receptora.status_cio_livre);
  const isPendente = receptora.status_cio_livre === 'PENDENTE';

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/15">
            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">Cio Livre</span>
            {isPendente && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Aguardando confirmação
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${badgeConfig.className} text-[10px] px-1.5 py-0`}>
            {badgeConfig.label}
          </Badge>
          {isPendente && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRejeitar}
              disabled={submitting}
              className="h-7 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Rejeitar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
