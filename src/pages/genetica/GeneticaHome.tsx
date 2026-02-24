/**
 * Página principal do Hub Genética - Vitrine de Vendas
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogoData } from '@/hooks/genetica';
import { AnimalCard } from '@/components/genetica';
import { Button, Badge } from '@/components/ui/mobile-atoms'; // DS v4
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function GeneticaHome() {
  const navigate = useNavigate();
  const { loading, destaques, doadoras, touros, loadHomeData } = useCatalogoData();
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Premium */}
      <div className="relative rounded-xl bg-gradient-to-br from-card via-card to-primary/5 p-8 overflow-hidden">
        {/* Decoração */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Dna className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Catálogo Genético</h1>
                <p className="text-sm text-muted-foreground">
                  Explore nossa seleção de doadoras e touros de elite
                </p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="bg-card border border-border">
            <Filter className="w-5 h-5" />
          </Button>
        </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/genetica/doadoras')}
              className="text-pink-600 hover:bg-pink-500/10"
            >
              <CowIcon className="w-4 h-4 mr-2" />
              Ver Doadoras
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/genetica/touros')}
              className="text-blue-600 hover:bg-blue-500/10"
            >
              <CowIcon className="w-4 h-4 mr-2" />
              Ver Touros
            </Button>
          </div>
        </div>
      </div>

      {/* Destaques (Carousel Horizontal) */}
      {destaques.length > 0 && (
        <section className="space-y-3">
          <div className="px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Destaques</h2>
            </div>
            <Badge variant="outline" className="text-amber-600">
              <Sparkles className="w-3 h-3 mr-1" />
              {destaques.length} em destaque
            </Badge>
          </div>
          
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide">
            {destaques.map((item) => (
              <div key={item.catalogo_id} className="min-w-[280px] snap-center">
                <AnimalCard
                  {...item}
                  tipo={item.tipo as 'doadora' | 'touro'}
                  variant="hero" // Novo visual hero
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid: Doadoras e Touros */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Doadoras */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <CowIcon className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Doadoras</h2>
                <p className="text-sm text-muted-foreground">Matrizes de elite</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/genetica/doadoras')}
              className="text-primary hover:text-primary/80"
            >
              Ver todas
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {doadoras.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doadoras.slice(0, 4).map((doadora) => (
                <AnimalCard
                  key={doadora.catalogo_id}
                  catalogoId={doadora.catalogo_id}
                  tipo="doadora"
                  nome={doadora.nome}
                  registro={doadora.registro}
                  raca={doadora.raca}
                  preco={doadora.preco}
                  destaque={doadora.destaque}
                  fotoUrl={doadora.foto_url}
                  fotoPrincipal={doadora.foto_principal}
                  paiNome={doadora.pai_nome}
                  maeNome={doadora.mae_nome}
                  fazendaNome={doadora.fazenda_nome}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-8">
              <EmptyState
                title="Nenhuma doadora"
                description="Ainda não há doadoras no catálogo"
              />
            </div>
          )}
        </section>

        {/* Touros */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CowIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Touros</h2>
                <p className="text-sm text-muted-foreground">Reprodutores selecionados</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/genetica/touros')}
              className="text-primary hover:text-primary/80"
            >
              Ver todos
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {touros.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {touros.slice(0, 4).map((touro) => (
                <AnimalCard
                  key={touro.catalogo_id}
                  catalogoId={touro.catalogo_id}
                  tipo="touro"
                  nome={touro.nome}
                  registro={touro.registro}
                  raca={touro.raca}
                  preco={touro.preco}
                  destaque={touro.destaque}
                  fotoUrl={touro.foto_url}
                  fotoPrincipal={touro.foto_principal}
                  paiNome={touro.pai_nome}
                  maeNome={touro.mae_nome}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-8">
              <EmptyState
                title="Nenhum touro"
                description="Ainda não há touros no catálogo"
              />
            </div>
          )}
        </section>
      </div>

      {/* Grid Principal */}
      <section className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Em Alta</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...doadoras, ...touros]
            .filter(item => 
              !search || 
              item.nome.toLowerCase().includes(search.toLowerCase()) || 
              item.raca?.toLowerCase().includes(search.toLowerCase())
            )
            .slice(0, 10) // Limitado para demo
            .map((item) => (
            <AnimalCard
              key={item.catalogo_id}
              {...item}
              tipo={item.tipo as 'doadora' | 'touro'}
            />
          ))}
        </div>
        
        <div className="mt-6 text-center">
          <Button variant="outline" fullWidth>
            Carregar mais
          </Button>
        </div>
      </section>
    </div>
  );
}

