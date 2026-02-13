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
      className="group rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:border-primary/40 hover:shadow-glow transition-all duration-500 cursor-pointer"
    >
      {/* Imagem com badge de destaque */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {foto ? (
          <img
            src={foto}
            alt={displayNome || ''}
            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <CowIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {destaque && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center gap-1 shadow-lg uppercase tracking-wider">
              <Star className="w-3 h-3 fill-current" />
              Destaque
            </div>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-white font-display font-bold tracking-tight truncate">{displayNome}</p>
          <p className="text-white/60 font-mono text-[10px] truncate uppercase tracking-widest">{registro}</p>
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

        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {fazendaNome || 'Haras Passatempo'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-[10px] font-mono uppercase tracking-widest text-primary hover:bg-primary/10"
          >
            Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AnimalCard;
