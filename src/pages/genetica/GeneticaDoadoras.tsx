/**
 * Página de listagem de doadoras do catálogo
 */

import { useEffect, useMemo } from 'react';
import { useCatalogoData } from '@/hooks/genetica';
import { AnimalCard, AnimalFilters } from '@/components/genetica';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { CowIcon } from '@/components/icons/CowIcon';

export default function GeneticaDoadoras() {
  const { loading, doadoras, loadDoadoras } = useCatalogoData();

  useEffect(() => {
    loadDoadoras();
  }, [loadDoadoras]);

  // Extrair raças únicas para o filtro
  const racas = useMemo(() => {
    const racasSet = new Set(doadoras.map((d) => d.raca).filter(Boolean) as string[]);
    return Array.from(racasSet).sort();
  }, [doadoras]);

  const handleFilter = (filters: { busca?: string; raca?: string }) => {
    loadDoadoras(filters);
  };

  if (loading && doadoras.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Doadoras"
          description="Catálogo de doadoras disponíveis"
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
        title="Doadoras"
        description="Catálogo de doadoras disponíveis"
        backTo="/genetica"
      >
        <Badge variant="outline" className="text-pink-600 border-pink-500/30">
          <CowIcon className="w-3 h-3 mr-1" />
          {doadoras.length} doadora{doadoras.length !== 1 ? 's' : ''}
        </Badge>
      </PageHeader>

      {/* Filtros */}
      <AnimalFilters
        onFilter={handleFilter}
        racas={racas}
        placeholder="Buscar doadora por nome ou registro..."
      />

      {/* Grid de doadoras */}
      {doadoras.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {doadoras.map((doadora) => (
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
              doadoraId={doadora.doadora_id}
              estoque={doadora.embrioes_disponiveis}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12">
          <EmptyState
            title="Nenhuma doadora encontrada"
            description="Tente ajustar os filtros ou aguarde novas adições ao catálogo"
          />
        </div>
      )}
    </div>
  );
}
