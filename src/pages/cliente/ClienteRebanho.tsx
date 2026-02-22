/**
 * Página "Meu Rebanho" para clientes
 * Visualização mobile-first de receptoras e doadoras
 *
 * OTIMIZADO: Usa hook de cache compartilhado, queries em paralelo
 * REFATORADO: Sistema de badges e design premium do CLAUDE.md
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/shared/PageHeader';
import LoadingScreen from '@/components/shared/LoadingScreen';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Beef, Search, MapPin, Filter } from 'lucide-react';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { ReceptoraCard } from '@/components/cliente/ReceptoraCard';
import { DoadoraCard } from '@/components/cliente/DoadoraCard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useClienteHubData, useDoadorasStats, useReceptorasCruzamento } from '@/hooks/cliente';
import CountBadge from '@/components/shared/CountBadge';

interface Receptora {
  id: string;
  identificacao?: string;
  status_reprodutivo?: string;
  data_provavel_parto?: string;
  fazenda_nome?: string;
  fazenda_id?: string;
  doadora_nome?: string;
  touro_nome?: string;
}

interface Doadora {
  id: string;
  nome?: string;
  registro?: string;
  raca?: string;
  media_oocitos?: number;
  total_aspiracoes?: number;
}

type StatusFilter = 'todas' | 'prenhes' | 'servidas' | 'sincronizadas' | 'vazias';

export default function ClienteRebanho() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clienteId } = usePermissions();

  const [activeTab, setActiveTab] = useState('receptoras');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas');
  const [filtroFazenda, setFiltroFazenda] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Aplicar filtro baseado no parâmetro "etapa" da URL
  useEffect(() => {
    const etapa = searchParams.get('etapa');
    if (etapa) {
      switch (etapa) {
        case 'protocolar':
          setStatusFilter('vazias');
          break;
        case '2passo':
        case 'te':
          setStatusFilter('sincronizadas');
          break;
        case 'dg':
          setStatusFilter('servidas');
          break;
        case 'sexagem':
          setStatusFilter('prenhes');
          break;
      }
      // Limpar o parâmetro da URL após aplicar o filtro
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Hook de cache compartilhado
  const { data: hubData, isLoading: hubLoading } = useClienteHubData(clienteId);

  // IDs das receptoras prenhes para buscar cruzamentos
  const prenhesIds = useMemo(() => {
    if (!hubData) return [];
    return hubData.receptoras
      .filter(r => r.status_reprodutivo?.includes('PRENHE'))
      .map(r => r.id);
  }, [hubData]);

  // Hook para buscar cruzamentos (doadora × touro) das prenhes
  const { data: cruzamentoMap } = useReceptorasCruzamento(prenhesIds);

  // Hook para estatísticas das doadoras
  const { data: doadorasStatsMap } = useDoadorasStats(hubData?.doadoraIds || []);

  // Receptoras com cruzamento adicionado
  const receptoras = useMemo((): Receptora[] => {
    if (!hubData) return [];

    return hubData.receptoras.map(r => ({
      ...r,
      doadora_nome: cruzamentoMap?.get(r.id)?.doadora,
      touro_nome: cruzamentoMap?.get(r.id)?.touro,
    }));
  }, [hubData, cruzamentoMap]);

  // Doadoras com estatísticas
  const doadoras = useMemo((): Doadora[] => {
    if (!hubData) return [];

    return hubData.doadoras.map(d => {
      const stats = doadorasStatsMap?.get(d.id);
      return {
        ...d,
        total_aspiracoes: stats?.total || 0,
        media_oocitos: stats && stats.total > 0 ? stats.soma / stats.total : 0,
      };
    });
  }, [hubData, doadorasStatsMap]);

  // Contadores
  const counts = useMemo(() => {
    if (!hubData) return { totalReceptoras: 0, prenhes: 0, servidas: 0, sincronizadas: 0, vazias: 0, totalDoadoras: 0 };

    const prenhes = receptoras.filter(r => r.status_reprodutivo?.includes('PRENHE')).length;
    const servidas = receptoras.filter(r => r.status_reprodutivo === 'SERVIDA').length;
    const sincronizadas = receptoras.filter(r => r.status_reprodutivo === 'SINCRONIZADA').length;
    const vazias = receptoras.filter(r =>
      r.status_reprodutivo === 'VAZIA' ||
      r.status_reprodutivo === 'DISPONIVEL' ||
      !r.status_reprodutivo
    ).length;

    return {
      totalReceptoras: receptoras.length,
      prenhes,
      servidas,
      sincronizadas,
      vazias,
      totalDoadoras: doadoras.length,
    };
  }, [hubData, receptoras, doadoras]);

  // Se não houver doadoras, garantir que a tab seja "receptoras"
  useEffect(() => {
    if (counts.totalDoadoras === 0 && activeTab === 'doadoras') {
      setActiveTab('receptoras');
    }
  }, [counts.totalDoadoras, activeTab]);

  // Filtrar receptoras
  const filteredReceptoras = useMemo(() => {
    return receptoras.filter(r => {
      // Filtro de fazenda
      if (filtroFazenda !== 'todas' && r.fazenda_id !== filtroFazenda) return false;

      // Filtro de status
      if (statusFilter === 'prenhes' && !r.status_reprodutivo?.includes('PRENHE')) return false;
      if (statusFilter === 'servidas' && r.status_reprodutivo !== 'SERVIDA') return false;
      if (statusFilter === 'sincronizadas' && r.status_reprodutivo !== 'SINCRONIZADA') return false;
      if (statusFilter === 'vazias') {
        const isVazia = r.status_reprodutivo === 'VAZIA' || r.status_reprodutivo === 'DISPONIVEL' || !r.status_reprodutivo;
        if (!isVazia) return false;
      }

      // Filtro de busca (apenas por identificação/brinco)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return r.identificacao?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [receptoras, filtroFazenda, statusFilter, searchTerm]);

  // Filtrar doadoras
  const filteredDoadoras = useMemo(() => {
    return doadoras.filter(d => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return d.nome?.toLowerCase().includes(search) ||
               d.registro?.toLowerCase().includes(search) ||
               d.raca?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [doadoras, searchTerm]);

  const fazendas = hubData?.fazendas || [];

  if (hubLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title="Meu Rebanho" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs premium com CountBadge */}
        {counts.totalDoadoras > 0 ? (
          <div className="rounded-xl border border-border/60 glass-panel p-1.5 shadow-sm">
            <TabsList className="grid grid-cols-2 h-auto p-0 bg-transparent gap-1.5">
              <TabsTrigger
                value="receptoras"
                className={cn(
                  'relative h-12 gap-2 rounded-lg font-medium transition-all duration-200',
                  'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                  activeTab === 'receptoras' ? 'bg-primary/15 border-primary/20' : 'bg-muted/50 border-transparent'
                )}>
                  <Beef className={cn('w-4 h-4', activeTab === 'receptoras' ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <span>Receptoras</span>
                <CountBadge
                  value={counts.totalReceptoras}
                  variant={activeTab === 'receptoras' ? 'primary' : 'default'}
                />
                {activeTab === 'receptoras' && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="doadoras"
                className={cn(
                  'relative h-12 gap-2 rounded-lg font-medium transition-all duration-200',
                  'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                  activeTab === 'doadoras' ? 'bg-amber-500/15 border-amber-500/20' : 'bg-muted/50 border-transparent'
                )}>
                  <DonorCowIcon className={cn('w-4 h-4', activeTab === 'doadoras' ? 'text-amber-500' : 'text-muted-foreground')} />
                </div>
                <span>Doadoras</span>
                <CountBadge
                  value={counts.totalDoadoras}
                  variant={activeTab === 'doadoras' ? 'warning' : 'default'}
                />
                {activeTab === 'doadoras' && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-amber-500 rounded-full" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 glass-panel p-1.5 shadow-sm">
            <div className="h-12 px-4 rounded-lg bg-muted/80 shadow-sm flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center border border-primary/20">
                <Beef className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium">Receptoras</span>
              <CountBadge value={counts.totalReceptoras} variant="primary" />
            </div>
          </div>
        )}

        {/* Busca premium com ícone destacado */}
        <div className="relative mt-4">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Search className="w-3.5 h-3.5 text-primary/70" />
          </div>
          <Input
            placeholder={activeTab === 'receptoras' ? 'Buscar por brinco...' : 'Buscar por nome ou registro...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 text-base rounded-xl border-border/60 glass-panel shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Tab Receptoras */}
        <TabsContent value="receptoras" className="mt-4 space-y-3">
          {/* Filtros premium em linha */}
          <div className="flex gap-2">
            {fazendas.length > 1 && (
              <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
                <SelectTrigger className="flex-1 h-10 rounded-xl border-border/60 glass-panel shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary/70" />
                    <SelectValue placeholder="Todas fazendas" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as fazendas</SelectItem>
                  {fazendas.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className={cn('h-10 rounded-xl border-border/60 glass-panel shadow-sm', fazendas.length > 1 ? 'flex-1' : 'w-full')}>
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary/70" />
                  <SelectValue placeholder="Todas" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({counts.totalReceptoras})</SelectItem>
                <SelectItem value="prenhes">Prenhes ({counts.prenhes})</SelectItem>
                <SelectItem value="servidas">Servidas ({counts.servidas})</SelectItem>
                <SelectItem value="sincronizadas">Sincronizadas ({counts.sincronizadas})</SelectItem>
                <SelectItem value="vazias">Vazias ({counts.vazias})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          {filteredReceptoras.length === 0 ? (
            <EmptyState
              title="Nenhuma receptora"
              description={searchTerm ? 'Nenhuma receptora encontrada para a busca' : 'Você ainda não possui receptoras cadastradas'}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredReceptoras.map((receptora) => (
                <ReceptoraCard
                  key={receptora.id}
                  data={receptora}
                  onClick={() => navigate(`/receptoras/${receptora.id}/historico`)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab Doadoras */}
        {counts.totalDoadoras > 0 && (
          <TabsContent value="doadoras" className="mt-4 space-y-3">
            {filteredDoadoras.length === 0 ? (
              <EmptyState
                title="Nenhuma doadora"
                description="Nenhuma doadora encontrada para a busca"
              />
            ) : (
              <div className="space-y-2.5">
                {filteredDoadoras.map((doadora) => (
                  <DoadoraCard
                    key={doadora.id}
                    data={doadora}
                    onClick={() => navigate(`/doadoras/${doadora.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
