/**
 * Card horizontal mobile-first para animal do Mercado de Genética
 * Otimizado para scanning rápido em listas longas
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dna, Package } from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';

interface MercadoAnimalCardProps {
  catalogoId: string;
  tipo: 'doadora' | 'touro';
  nome: string | null;
  registro: string;
  raca: string | null;
  preco: number | null;
  fotoUrl: string | null;
  fotoPrincipal?: string | null;
  paiNome: string | null;
  maeNome: string | null;
  estoque?: number;
  onReservar: () => void;
  onDetalhes: () => void;
}

export function MercadoAnimalCard({
  tipo,
  nome,
  registro,
  raca,
  preco,
  fotoUrl,
  fotoPrincipal,
  paiNome,
  maeNome,
  estoque,
  onReservar,
  onDetalhes,
}: MercadoAnimalCardProps) {
  const foto = fotoPrincipal || fotoUrl;
  const displayNome = nome || registro;
  const estoqueLabel = tipo === 'doadora' ? 'embriões' : 'doses';

  return (
    <div className="flex gap-3 rounded-xl border border-border/60 glass-panel p-3 hover:border-foreground/20 hover:shadow-md transition-all duration-200">
      {/* Foto */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-muted">
        {foto ? (
          <img
            src={foto}
            alt={displayNome}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <CowIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Badge estoque */}
        {estoque !== undefined && estoque > 0 && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-green text-[#080B0A] text-[10px] font-bold flex items-center gap-0.5">
            <Package className="w-2.5 h-2.5" />
            {estoque}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Cabeçalho */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{displayNome}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{registro}</p>
            </div>
            {raca && (
              <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                <Dna className="w-2.5 h-2.5 mr-0.5" />
                {raca}
              </Badge>
            )}
          </div>

          {/* Genealogia 1-liner */}
          {(paiNome || maeNome) && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {paiNome && maeNome
                ? `${paiNome} × ${maeNome}`
                : paiNome
                  ? `Pai: ${paiNome}`
                  : `Mãe: ${maeNome}`}
            </p>
          )}
        </div>

        {/* Preço + ações */}
        <div className="flex items-center justify-between mt-2">
          <div>
            {preco ? (
              <p className="text-sm font-mono font-bold text-gradient-logo">
                {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">Consultar</p>
            )}
            {estoque !== undefined && estoque > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {estoque} {estoqueLabel} disp.
              </p>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation();
                onDetalhes();
              }}
            >
              Detalhes
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs px-3 btn-primary-gold border-0"
              onClick={(e) => {
                e.stopPropagation();
                onReservar();
              }}
            >
              Reservar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
