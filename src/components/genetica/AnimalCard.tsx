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
  doadoraId?: string | null;
  touroId?: string | null;
  estoque?: number;
  variant?: 'default' | 'hero';
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
  variant = 'default',
}: AnimalCardProps) {
  const navigate = useNavigate();
  const foto = fotoPrincipal || fotoUrl;
  const displayNome = nome || registro;

  const handleClick = () => {
    navigate(`/genetica/${tipo === 'doadora' ? 'doadoras' : 'touros'}/${catalogoId}`);
  };

  if (variant === 'hero') {
    return (
      <div 
        onClick={handleClick}
        className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl group cursor-pointer"
      >
        {foto ? (
          <img src={foto} alt={displayNome || ''} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-card flex items-center justify-center">
            <CowIcon className="w-20 h-20 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 p-6 w-full">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest border-none">
              Elite {tipo}
            </Badge>
            {raca && <span className="text-white/60 text-xs font-medium">{raca}</span>}
          </div>
          <h3 className="text-2xl font-display font-black text-white tracking-tightest mb-1">
            {displayNome}
          </h3>
          <p className="text-sm text-white/70 font-mono">{registro}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="group rounded-xl border border-border glass-panel overflow-hidden hover:border-foreground/30 hover:shadow-md transition-all duration-300 cursor-pointer"
    >
      {/* Imagem com badge de destaque */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {foto ? (
          <img
            src={foto}
            alt={displayNome}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <CowIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {destaque && (
            <div className="px-2 py-1 rounded-full bg-foreground text-background text-xs font-bold flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              Destaque
            </div>
          )}
          {estoque !== undefined && estoque > 0 && (
            <div className="px-2 py-1 rounded-full bg-green text-[#080B0A] glow-green text-xs font-bold flex items-center gap-1 shadow-md">
              <Package className="w-3 h-3" />
              {estoque} {estoqueLabel}
            </div>
          )}
        </div>

        {/* Badge de tipo */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={`text-xs backdrop-blur-sm ${tipo === 'doadora'
              ? 'bg-pink-500/80 text-white border-pink-400'
              : 'bg-blue-500/80 text-white border-blue-400'
              }`}
          >
            {tipo === 'doadora' ? 'Doadora' : 'Touro'}
          </Badge>
        </div>

        {/* Overlay com nome */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#080B0A]/90 via-[#080B0A]/50 to-transparent p-3 pt-8">
          <p className="text-white font-bold truncate text-base">{displayNome}</p>
          <p className="text-muted-foreground font-mono text-xs truncate mt-0.5">{registro}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary uppercase tracking-widest bg-primary/5">
            {raca || 'Mestiça'}
          </Badge>
          {preco && (
            <span className="text-sm font-display font-bold text-foreground tracking-tight">
              {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                <p className="text-xl font-mono font-bold text-gradient-logo">
                  {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">Consultar</p>
            )}
          </div>
          <Button
            size="sm"
            className="btn-primary-gold border-0"
          >
            Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AnimalCard;
