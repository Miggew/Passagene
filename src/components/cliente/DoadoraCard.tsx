/**
 * Card mobile-friendly para exibir doadora
 * Design premium com estatísticas visuais
 * Refatorado com sistema de badges padronizado
 */

import { Hash, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import CountBadge from '@/components/shared/CountBadge';

interface DoadoraCardProps {
  data: {
    id: string;
    nome?: string;
    registro?: string;
    raca?: string;
    media_oocitos?: number;
    total_aspiracoes?: number;
    fotoUrl?: string;
    preco?: number;
  };
  onClick?: () => void;
}

export function DoadoraCard({ data, onClick }: DoadoraCardProps) {
  const hasStats = data.total_aspiracoes && data.total_aspiracoes > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border glass-panel overflow-hidden transition-all duration-300',
        onClick && 'cursor-pointer hover:border-foreground/30 hover:shadow-md'
      )}
    >
      {/* Área da Imagem */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0F1412] to-[#151C1A]">
        {data.fotoUrl ? (
          <img src={data.fotoUrl} alt={data.nome} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <DonorCowIcon className="w-24 h-24 opacity-20 text-amber-500" />
        )}

        {/* Badge Superior Esquerdo */}
        <div className="absolute top-2 left-2 flex gap-2">
          <div className="px-2 py-1 rounded-full bg-[#0F1412]/80 backdrop-blur-sm text-white text-xs font-bold border border-border">
            Doadora
          </div>
          {data.raca && (
            <div className="px-2 py-1 rounded-full bg-[#0F1412]/80 backdrop-blur-sm text-white/80 text-xs font-medium border border-border">
              {data.raca}
            </div>
          )}
        </div>

        {/* Overlay Inferior */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#080B0A]/90 via-[#080B0A]/50 to-transparent p-3 pt-8">
          <p className="text-white font-bold text-base truncate">{data.nome || data.registro || 'Sem nome'}</p>
          {data.registro && (
            <p className="text-muted-foreground font-mono text-xs mt-0.5 truncate flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {data.registro}
            </p>
          )}
        </div>
      </div>

      {/* Info Inferior */}
      <div className="p-3">
        {hasStats && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Aspirações</span>
              <span className="text-foreground font-bold">{data.total_aspiracoes}</span>
            </div>
            {data.media_oocitos !== undefined && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Média oócitos</span>
                <span className="text-amber-500 font-bold">{Math.round(data.media_oocitos)}</span>
              </div>
            )}
          </div>
        )}

        {data.preco && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Embrião a partir de</span>
            <span className="text-lg font-mono text-gradient-logo font-bold">
              {data.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
