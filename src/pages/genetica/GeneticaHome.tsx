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
    <div className="pb-20 space-y-6">
      {/* Mobile Header / Hero */}
      <div className="px-4 pt-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Marketplace</h1>
            <p className="text-xs text-muted-foreground">Genética de elite ao seu alcance</p>
          </div>
          <Button variant="ghost" size="icon" className="bg-card border border-border">
            <Filter className="w-5 h-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, registro ou raça..." 
            className="pl-10 h-12 rounded-xl bg-card border-border shadow-sm text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

      {/* Categorias (Pills) */}
      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide">
        <Badge variant="default" className="h-8 px-4 text-sm whitespace-nowrap">Todos</Badge>
        <Badge variant="secondary" className="h-8 px-4 text-sm whitespace-nowrap">Doadoras</Badge>
        <Badge variant="secondary" className="h-8 px-4 text-sm whitespace-nowrap">Touros</Badge>
        <Badge variant="secondary" className="h-8 px-4 text-sm whitespace-nowrap">Embriões</Badge>
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

