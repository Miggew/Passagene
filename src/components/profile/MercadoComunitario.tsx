/**
 * Tab "Comunidade" no ClienteMercado — anúncios C2C.
 */

import { useState } from 'react';
import { Search, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnunciosAtivos } from '@/hooks/useAnuncios';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import SellerProfileCard from './SellerProfileCard';
import type { AnuncioUsuario, AnuncioTipo } from '@/lib/types';
import { cn } from '@/lib/utils';

const tipoLabels: Record<string, string> = {
  doadora: 'Doadora',
  touro: 'Touro',
  embriao: 'Embrião',
  dose: 'Dose',
  outro: 'Outro',
};

function AnuncioPublicoCard({ anuncio }: { anuncio: AnuncioUsuario }) {
  const { data: fotoUrl } = useProfileUrl(anuncio.foto_principal);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md">
      {/* Foto */}
      <div className="aspect-[4/3] bg-muted">
        {fotoUrl ? (
          <img src={fotoUrl} alt={anuncio.titulo} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Tag className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <span className="text-[10px] font-semibold text-primary-600 uppercase">
          {tipoLabels[anuncio.tipo]}
        </span>

        <p className="text-sm font-bold text-foreground line-clamp-2">{anuncio.titulo}</p>

        {anuncio.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">{anuncio.descricao}</p>
        )}

        {anuncio.preco != null && (
          <p className="text-base font-extrabold text-foreground">
            R$ {anuncio.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            {anuncio.preco_negociavel && (
              <span className="text-[10px] font-medium text-muted-foreground ml-1">negociável</span>
            )}
          </p>
        )}

        {/* Seller card */}
        <div className="border-t border-border pt-2 -mx-3 px-1">
          <SellerProfileCard
            nome={anuncio.vendedor_nome}
            avatarPath={anuncio.vendedor_avatar}
            slug={anuncio.vendedor_slug}
            localizacao={anuncio.vendedor_localizacao}
          />
        </div>
      </div>
    </div>
  );
}

export default function MercadoComunitario() {
  const [tipo, setTipo] = useState<AnuncioTipo | 'todos'>('todos');
  const [busca, setBusca] = useState('');

  const { data: anuncios = [], isLoading } = useAnunciosAtivos({ tipo, busca });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar anúncios..."
            className="pl-9"
          />
        </div>

        <Select value={tipo} onValueChange={(v) => setTipo(v as AnuncioTipo | 'todos')}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="doadora">Doadoras</SelectItem>
            <SelectItem value="touro">Touros</SelectItem>
            <SelectItem value="embriao">Embriões</SelectItem>
            <SelectItem value="dose">Doses</SelectItem>
            <SelectItem value="outro">Outros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de anúncios */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : anuncios.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {anuncios.map(a => (
            <AnuncioPublicoCard key={a.id} anuncio={a} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhum anúncio encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Seja o primeiro a publicar! Acesse seu perfil para criar anúncios.
          </p>
        </div>
      )}
    </div>
  );
}
