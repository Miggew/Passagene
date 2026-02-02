/**
 * Página de listagem de touros do catálogo
 */

import { useEffect, useMemo } from 'react';
import { useCatalogoData } from '@/hooks/genetica';
import { AnimalCard, AnimalFilters } from '@/components/genetica';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { CowIcon } from '@/components/icons/CowIcon';

export default function GeneticaTouros() {
  const { loading, touros, loadTouros } = useCatalogoData();

  useEffect(() => {
    loadTouros();
  }, [loadTouros]);

  // Extrair raças únicas para o filtro
  const racas = useMemo(() => {
    const racasSet = new Set(touros.map((t) => t.raca).filter(Boolean) as string[]);
    return Array.from(racasSet).sort();
  }, [touros]);

  const handleFilter = (filters: { busca?: string; raca?: string }) => {
    loadTouros(filters);
  };

  if (loading && touros.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Touros"
          description="Catálogo de touros disponíveis"
          backTo="/genetica"
        />
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Touros"
        description="Catálogo de touros disponíveis"
        backTo="/genetica"
      >
        <Badge variant="outline" className="text-blue-600 border-blue-500/30">
          <CowIcon className="w-3 h-3 mr-1" />
          {touros.length} touro{touros.length !== 1 ? 's' : ''}
        </Badge>
      </PageHeader>

      {/* Filtros */}
      <AnimalFilters
        onFilter={handleFilter}
        racas={racas}
        placeholder="Buscar touro por nome ou registro..."
      />

      {/* Grid de touros */}
      {touros.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {touros.map((touro) => (
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
              touroId={touro.touro_id}
              estoque={touro.doses_disponiveis}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12">
          <EmptyState
            title="Nenhum touro encontrado"
            description="Tente ajustar os filtros ou aguarde novas adições ao catálogo"
          />
        </div>
      )}
    </div>
  );
}
