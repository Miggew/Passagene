/**
 * Card mobile-friendly para exibir embriões agrupados
 * Design premium com destaque para contagem
 * Refatorado com sistema de badges padronizado
 */

import { Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import CountBadge from '@/components/shared/CountBadge';

interface EmbrioCardProps {
  data: {
    id: string;
    nome: string;
    registro?: string;
    count: number;
    fotoUrl?: string;
    preco?: number;
  };
  tipo: 'doadora' | 'touro';
  onClick?: () => void;
}

export function EmbrioCard({ data, tipo, onClick }: EmbrioCardProps) {
  const Icon = tipo === 'doadora' ? DonorCowIcon : SpermIcon;
  const isDoadora = tipo === 'doadora';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border glass-panel overflow-hidden transition-all duration-300',
        onClick && 'cursor-pointer hover:border-foreground/30 hover:shadow-md'
      )}
    >
      {/* Área da Imagem (mín 40%) */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0F1412] to-[#151C1A]">
        {data.fotoUrl ? (
          <img src={data.fotoUrl} alt={data.nome} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <Icon className={cn('w-20 h-20 opacity-20', isDoadora ? 'text-amber-500' : 'text-indigo-500')} />
        )}

        {/* Badge Superior Esquerdo */}
        <div className="absolute top-2 left-2">
          <div className="px-2 py-1 rounded-full bg-[#0F1412]/80 backdrop-blur-sm text-white text-xs font-bold flex items-center gap-1.5 border border-border">
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            {data.count} Embriões
          </div>
        </div>

        {/* Overlay Inferior (Nome / ID) */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#080B0A]/90 via-[#080B0A]/50 to-transparent p-3 pt-8">
          <p className="text-white font-bold text-base truncate">{data.nome || 'Lote de Embriões'}</p>
          {data.registro && (
            <p className="text-muted-foreground font-mono text-xs mt-0.5 truncate">{data.registro}</p>
          )}
        </div>
      </div>

      {/* Info Inferior */}
      <div className="p-3">
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-muted-foreground font-medium">Quantidade:</span>
          <span className="text-xl font-mono text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">{data.count}</span>
        </div>
        {data.preco && (
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Valor unitário a partir de</span>
            <span className="text-lg font-mono text-gradient-logo font-bold">
              {data.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
