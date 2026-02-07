/**
 * Card mobile-friendly para exibir receptora
 * Design premium com cores semânticas por status
 * Refatorado com sistema de badges padronizado
 */

import { Beef, Calendar, MapPin, Baby, Dna, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import StatusBadge from '@/components/shared/StatusBadge';
import CountBadge from '@/components/shared/CountBadge';

interface ReceptoraCardProps {
  data: {
    id: string;
    identificacao?: string;
    status_reprodutivo?: string;
    data_provavel_parto?: string;
    fazenda_nome?: string;
    doadora_nome?: string;
    touro_nome?: string;
  };
  onClick?: () => void;
}

export function ReceptoraCard({ data, onClick }: ReceptoraCardProps) {
  const status = data.status_reprodutivo || 'VAZIA';
  const isPrenhe = status.includes('PRENHE');
  const isFemea = status === 'PRENHE_FEMEA';
  const isMacho = status === 'PRENHE_MACHO';
  const isGemeos = status === 'PRENHE_2_SEXOS';
  const isSemSexo = status === 'PRENHE_SEM_SEXO';
  const hasCruzamento = isPrenhe && (data.doadora_nome || data.touro_nome);

  // Cores semióticas baseadas no estágio reprodutivo
  const getStatusStyle = () => {
    // Fêmea = rosa (semiótica universal)
    if (isFemea) return {
      border: 'border-pink-500/25',
      bg: 'bg-gradient-to-r from-pink-500/[0.06] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-pink-500/20 to-pink-500/5 border-pink-500/15',
      iconColor: 'text-pink-500',
      calendarBg: 'bg-pink-500/10',
    };
    // Macho = azul (semiótica universal)
    if (isMacho) return {
      border: 'border-blue-500/25',
      bg: 'bg-gradient-to-r from-blue-500/[0.06] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/15',
      iconColor: 'text-blue-500',
      calendarBg: 'bg-blue-500/10',
    };
    // Gêmeos = índigo (especial)
    if (isGemeos) return {
      border: 'border-indigo-500/25',
      bg: 'bg-gradient-to-r from-indigo-500/[0.06] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border-indigo-500/15',
      iconColor: 'text-indigo-500',
      calendarBg: 'bg-indigo-500/10',
    };
    // Sem sexo = roxo (indefinido)
    if (isSemSexo) return {
      border: 'border-purple-500/25',
      bg: 'bg-gradient-to-r from-purple-500/[0.06] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/15',
      iconColor: 'text-purple-500',
      calendarBg: 'bg-purple-500/10',
    };
    // Prenhe (aguardando sexagem) = verde (sucesso!)
    if (isPrenhe) return {
      border: 'border-green-500/25',
      bg: 'bg-gradient-to-r from-green-500/[0.06] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/15',
      iconColor: 'text-green-500',
      calendarBg: 'bg-green-500/10',
    };
    // Servida = violeta (aguardando resultado)
    if (status === 'SERVIDA') return {
      border: 'border-violet-500/20',
      bg: 'bg-gradient-to-r from-violet-500/[0.04] via-transparent to-transparent',
      iconBg: 'bg-gradient-to-br from-violet-500/15 to-violet-500/5 border-violet-500/10',
      iconColor: 'text-violet-500',
      calendarBg: 'bg-violet-500/10',
    };
    // Vazia/outros = neutro
    return {
      border: 'border-border/60',
      bg: '',
      iconBg: 'bg-muted/80 border-border/50',
      iconColor: 'text-muted-foreground',
      calendarBg: 'bg-muted/50',
    };
  };

  const style = getStatusStyle();

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border bg-card p-3.5 transition-all duration-200 active:scale-[0.98] shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30',
        style.border,
        style.bg
      )}
    >
      <div className="flex items-center gap-3">
        {/* Ícone com gradiente */}
        <div className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
          style.iconBg
        )}>
          {isPrenhe ? (
            <Baby className={cn('w-5 h-5', style.iconColor)} />
          ) : (
            <Beef className={cn('w-5 h-5', style.iconColor)} />
          )}
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-base truncate">
              {data.identificacao || 'Sem ID'}
            </p>
          </div>
          {data.fazenda_nome && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0 opacity-60" />
              <span className="truncate">{data.fazenda_nome}</span>
            </p>
          )}
        </div>

        {/* Status e seta */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} />
          {onClick && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          )}
        </div>
      </div>

      {/* Info adicional de prenhez - Premium */}
      {isPrenhe && (data.data_provavel_parto || hasCruzamento) && (
        <div className="mt-3 pt-2.5 border-t border-border/30 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {/* Cruzamento com indicador premium */}
          {hasCruzamento && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                <Dna className="w-3 h-3 text-primary" />
              </div>
              <span className="text-muted-foreground text-xs truncate max-w-[180px]">
                {data.doadora_nome || '?'} <span className="text-primary font-semibold">×</span> {data.touro_nome || '?'}
              </span>
            </div>
          )}

          {/* Data de parto com CountBadge */}
          {data.data_provavel_parto && (() => {
            const diasParaParto = differenceInDays(new Date(data.data_provavel_parto), new Date());
            const partoProximo = diasParaParto <= 7 && diasParaParto >= 0;
            return (
              <div className="flex items-center gap-1.5">
                <div className={cn('w-5 h-5 rounded flex items-center justify-center', style.calendarBg)}>
                  <Calendar className={cn('w-3 h-3', style.iconColor)} />
                </div>
                <span className="text-xs text-muted-foreground">Parto</span>
                <span className={cn('text-xs font-semibold', style.iconColor)}>
                  {format(new Date(data.data_provavel_parto), "dd MMM", { locale: ptBR })}
                </span>
                {partoProximo && (
                  <CountBadge value={`${diasParaParto}d`} variant="warning" size="sm" />
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
