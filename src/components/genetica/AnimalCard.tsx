/**
 * Card de animal para o catálogo genético - Design Premium
 */

import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Dna, MapPin, Package } from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';

interface AnimalCardProps {
  catalogoId: string;
  tipo: 'doadora' | 'touro';
  nome: string | null;
  registro: string;
  raca: string | null;
  preco: number | null;
  destaque?: boolean;
  fotoUrl: string | null;
  fotoPrincipal?: string | null;
  paiNome: string | null;
  maeNome: string | null;
  fazendaNome?: string | null;
  // IDs reais para link
  doadoraId?: string | null;
  touroId?: string | null;
  // Estoque
  estoque?: number;
}

export function AnimalCard({
  catalogoId,
  tipo,
  nome,
  registro,
  raca,
  preco,
  destaque,
  fotoUrl,
  fotoPrincipal,
  paiNome,
  maeNome,
  fazendaNome,
  doadoraId,
  touroId,
  estoque,
}: AnimalCardProps) {
  const navigate = useNavigate();
  const foto = fotoPrincipal || fotoUrl;
  const displayNome = nome || registro;

  // ID real do animal para link
  const animalRealId = tipo === 'doadora' ? doadoraId : touroId;
  const estoqueLabel = tipo === 'doadora' ? 'embriões' : 'doses';

  const handleClick = () => {
    navigate(`/genetica/${tipo === 'doadora' ? 'doadoras' : 'touros'}/${catalogoId}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
    >
      {/* Imagem com badge de destaque */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {foto ? (
          <img
            src={foto}
            alt={displayNome}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <CowIcon className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges superiores direita */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {destaque && (
            <div className="px-2 py-1 rounded-full bg-amber-500/90 text-white text-xs font-medium flex items-center gap-1 shadow-lg">
              <Star className="w-3 h-3 fill-current" />
              Destaque
            </div>
          )}
          {estoque !== undefined && estoque > 0 && (
            <div className="px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-medium flex items-center gap-1 shadow-lg">
              <Package className="w-3 h-3" />
              {estoque} {estoqueLabel}
            </div>
          )}
        </div>

        {/* Badge de tipo */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={`text-xs backdrop-blur-sm ${
              tipo === 'doadora'
                ? 'bg-pink-500/80 text-white border-pink-400'
                : 'bg-blue-500/80 text-white border-blue-400'
            }`}
          >
            {tipo === 'doadora' ? 'Doadora' : 'Touro'}
          </Badge>
        </div>

        {/* Overlay com nome */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3">
          <p className="text-white font-semibold truncate">{displayNome}</p>
          <p className="text-white/80 text-sm truncate">{registro}</p>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          {raca && (
            <Badge variant="outline" className="text-xs">
              <Dna className="w-3 h-3 mr-1" />
              {raca}
            </Badge>
          )}
          {fazendaNome && (
            <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {fazendaNome}
            </span>
          )}
        </div>

        {/* Genealogia resumida */}
        {(paiNome || maeNome) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {paiNome && (
              <p className="truncate">
                <span className="font-medium text-foreground">Pai:</span> {paiNome}
              </p>
            )}
            {maeNome && (
              <p className="truncate">
                <span className="font-medium text-foreground">Mãe:</span> {maeNome}
              </p>
            )}
          </div>
        )}

        {/* Preço e ação */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            {preco ? (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {tipo === 'doadora' ? 'Embrião' : 'Dose'} a partir de
                </p>
                <p className="text-lg font-bold text-primary">
                  {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Consultar preço</p>
            )}
          </div>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 shadow-sm shadow-primary/25"
          >
            Ver mais
          </Button>
        </div>

        {/* Link para ficha completa do animal real */}
        {animalRealId && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(tipo === 'doadora' ? `/doadoras/${animalRealId}` : `/touros/${animalRealId}`);
              }}
            >
              Ver ficha completa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnimalCard;
