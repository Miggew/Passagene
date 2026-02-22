/**
 * Página principal do Hub Genética - Vitrine de Vendas
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogoData } from '@/hooks/genetica';
import { AnimalCard } from '@/components/genetica';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import {
  Dna,
  ArrowRight,
  Star,
  Sparkles,
} from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';

export default function GeneticaHome() {
  const navigate = useNavigate();
  const { loading, destaques, doadoras, touros, loadHomeData } = useCatalogoData();

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <Skeleton className="h-32 rounded-xl" />
        {/* Destaques skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
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

      {/* Destaques */}
      {destaques.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Destaques</h2>
                <p className="text-sm text-muted-foreground">Seleção especial da semana</p>
              </div>
            </div>
            <Badge variant="outline" className="text-amber-600">
              <Sparkles className="w-3 h-3 mr-1" />
              {destaques.length} em destaque
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {destaques.map((item) => (
              <AnimalCard
                key={item.catalogo_id}
                catalogoId={item.catalogo_id}
                tipo={item.tipo}
                nome={item.nome}
                registro={item.registro}
                raca={item.raca}
                preco={item.preco}
                destaque={item.destaque}
                fotoUrl={item.foto_url}
                fotoPrincipal={item.foto_principal}
                paiNome={item.pai_nome}
                maeNome={item.mae_nome}
                fazendaNome={item.fazenda_nome}
              />
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
    </div>
  );
}
