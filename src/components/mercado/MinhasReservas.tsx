/**
 * Lista de reservas do cliente no Mercado de Genética
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { CowIcon } from '@/components/icons/CowIcon';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReservaGenetica } from '@/hooks/cliente/useMercadoGenetica';

interface MinhasReservasProps {
  reservas: ReservaGenetica[];
  onCancelar: (id: string) => void;
  cancelando?: string | null;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  PENDENTE: {
    label: 'Pendente',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  CONFIRMADA: {
    label: 'Confirmada',
    className: 'bg-green-500/15 text-green-600 dark:text-green-400',
  },
  RECUSADA: {
    label: 'Recusada',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400',
  },
  CANCELADA: {
    label: 'Cancelada',
    className: 'bg-muted text-muted-foreground',
  },
  CONCLUIDA: {
    label: 'Concluída',
    className: 'bg-primary/15 text-primary',
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function MinhasReservas({ reservas, onCancelar, cancelando }: MinhasReservasProps) {
  if (reservas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma reserva"
        description="Você ainda não solicitou nenhuma reserva. Navegue o catálogo e reserve seu material genético."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {reservas.map((r) => {
        const badge = statusBadge[r.status] || statusBadge.PENDENTE;

        return (
          <div
            key={r.id}
            className="rounded-xl border border-border/60 glass-panel p-3 space-y-2"
          >
            {/* Header: animal + status */}
            <div className="flex items-start gap-3">
              {/* Foto mini */}
              <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                {r.animal_foto ? (
                  <img
                    src={r.animal_foto}
                    alt={r.animal_nome || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CowIcon className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">{r.animal_nome || 'Animal'}</p>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 text-[10px] px-1.5 py-0 border-transparent', badge.className)}
                  >
                    {badge.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.tipo === 'doadora' ? 'Doadora' : 'Touro'}
                  {r.animal_raca && ` · ${r.animal_raca}`}
                </p>
              </div>
            </div>

            {/* Detalhes */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              {r.data_desejada && (
                <p>Data desejada: <span className="text-foreground">{formatDate(r.data_desejada)}</span></p>
              )}
              {r.quantidade_embrioes && (
                <p>Quantidade: <span className="text-foreground">{r.quantidade_embrioes} {r.tipo === 'doadora' ? 'embriões' : 'doses'}</span></p>
              )}
              {r.observacoes && (
                <p>Obs: <span className="text-foreground">{r.observacoes}</span></p>
              )}
              <p className="text-[10px]">Solicitada em {formatDate(r.created_at)}</p>
            </div>

            {/* Resposta admin */}
            {r.resposta_admin && (
              <div className="p-2 rounded-lg bg-muted/50 text-xs">
                <p className="font-medium text-foreground mb-0.5">Resposta:</p>
                <p className="text-muted-foreground">{r.resposta_admin}</p>
              </div>
            )}

            {/* Ação cancelar */}
            {r.status === 'PENDENTE' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-red-500"
                onClick={() => onCancelar(r.id)}
                disabled={cancelando === r.id}
              >
                {cancelando === r.id ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Cancelar reserva
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
