/**
 * Página "Genética" unificada para clientes
 * Catálogo do mercado + Meu Botijão (doses/embriões) + Reservas
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/hooks/core/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import { useMercadoCatalogo, useMinhasReservas, useCriarReserva, useCancelarReserva } from '@/hooks/cliente';
import { useClienteHubData, useEmbrioesDetalhes } from '@/hooks/cliente';
import PageHeader from '@/components/shared/PageHeader';
import LoadingScreen from '@/components/shared/LoadingScreen';
import EmptyState from '@/components/shared/EmptyState';
import CountBadge from '@/components/shared/CountBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MercadoFilters, MercadoAnimalCard, ReservaDialog, MinhasReservas } from '@/components/mercado';
import { TouroCard } from '@/components/cliente/TouroCard';
import { EmbrioCard } from '@/components/cliente/EmbrioCard';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dna, ShoppingBag, ClipboardList, Container, Snowflake, Search, RefreshCw, Users } from 'lucide-react';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import MercadoComunitario from '@/components/profile/MercadoComunitario';
import type { CatalogoDoadora, CatalogoTouro } from '@/hooks/genetica/useCatalogoData';

type TipoFilter = 'todos' | 'doadora' | 'touro';

interface AnimalResumo {
  catalogoId: string;
  tipo: 'doadora' | 'touro';
  nome: string;
  registro: string;
  foto: string | null;
  preco: number | null;
}

interface Embriao {
  id: string;
  classificacao?: string;
  status_atual?: string;
  doadora_nome?: string;
  doadora_id?: string;
  touro_nome?: string;
  touro_id?: string;
}

interface EmbriaoAgrupado {
  id: string;
  nome: string;
  registro?: string;
  count: number;
}

export default function ClienteMercado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clienteId } = usePermissions();
  const { toast } = useToast();

  // State — Catálogo (inicializar tab a partir da URL se presente)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'botijao' || tabParam === 'reservas' || tabParam === 'comunidade' ? tabParam : 'catalogo'
  );
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [racaFilter, setRacaFilter] = useState('');
  const [buscaFilter, setBuscaFilter] = useState('');
  const [reservaAnimal, setReservaAnimal] = useState<AnimalResumo | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  // State — Botijão
  const [embrioesSubTab, setEmbrioesSubTab] = useState<'doadora' | 'touro'>('doadora');
  const [botijaoSubTab, setBotijaoSubTab] = useState<'doses' | 'embrioes'>('doses');
  const [botijaoSearch, setBotijaoSearch] = useState('');

  // ─── Debounce ────────────────────────────────────────────────────
  const debouncedBusca = useDebounce(buscaFilter, 300);
  const debouncedBotijaoSearch = useDebounce(botijaoSearch, 300);

  // ─── Catálogo Queries ──────────────────────────────────────────────
  const { data: catalogo, isLoading: catalogoLoading, isError: catalogoError, refetch: refetchCatalogo } = useMercadoCatalogo({
    tipo: tipoFilter,
    raca: racaFilter || undefined,
    busca: debouncedBusca || undefined,
  });

  const { data: reservas = [], isLoading: reservasLoading } = useMinhasReservas(clienteId);

  // ─── Botijão Queries ───────────────────────────────────────────────
  const { data: hubData, isLoading: hubLoading, isError: hubError, refetch: refetchHub } = useClienteHubData(clienteId);

  const acasalamentoIds = useMemo(() => {
    if (!hubData) return [];
    return [...new Set(
      hubData.embrioes
        .map(e => e.lote_fiv_acasalamento_id)
        .filter(Boolean) as string[]
    )];
  }, [hubData]);

  const { data: embrioesDetalhes } = useEmbrioesDetalhes(acasalamentoIds);

  // ─── Catálogo Mutations ────────────────────────────────────────────
  const criarReserva = useCriarReserva();
  const cancelarReserva = useCancelarReserva();

  // ─── Catálogo Derived ──────────────────────────────────────────────
  const itens = useMemo(() => {
    if (!catalogo) return [];
    const items: Array<{ tipo: 'doadora' | 'touro'; data: CatalogoDoadora | CatalogoTouro }> = [];
    for (const d of catalogo.doadoras) items.push({ tipo: 'doadora', data: d });
    for (const t of catalogo.touros) items.push({ tipo: 'touro', data: t });
    return items;
  }, [catalogo]);

  const totalCatalogo = itens.length;
  const reservasPendentes = reservas.filter(r => r.status === 'PENDENTE').length;

  // ─── Botijão Derived ──────────────────────────────────────────────
  const embrioes = useMemo((): Embriao[] => {
    if (!hubData) return [];
    return hubData.embrioes.map(e => {
      const acasId = e.lote_fiv_acasalamento_id;
      const doadoraInfo = acasId ? embrioesDetalhes?.doadoraMap.get(acasId) : undefined;
      const touroInfo = acasId ? embrioesDetalhes?.touroMap.get(acasId) : undefined;
      return {
        id: e.id,
        classificacao: e.classificacao,
        status_atual: e.status_atual,
        doadora_nome: doadoraInfo?.nome,
        doadora_id: doadoraInfo?.id,
        touro_nome: touroInfo?.nome,
        touro_id: touroInfo?.id,
      };
    });
  }, [hubData, embrioesDetalhes]);

  const tourosDoses = hubData?.tourosDoses || [];
  const totalDoses = hubData?.totalDoses || 0;
  const totalEmbrioes = hubData?.totalEmbrioes || 0;
  const totalBotijao = totalDoses + totalEmbrioes;

  const filteredTouros = useMemo(() => {
    return tourosDoses.filter(t => {
      if (!debouncedBotijaoSearch) return true;
      const search = debouncedBotijaoSearch.toLowerCase();
      return t.nome?.toLowerCase().includes(search) ||
             t.registro?.toLowerCase().includes(search) ||
             t.raca?.toLowerCase().includes(search);
    });
  }, [tourosDoses, debouncedBotijaoSearch]);

  const embrioesAgrupados = useMemo((): EmbriaoAgrupado[] => {
    const map = new Map<string, { nome: string; count: number }>();
    embrioes.forEach(e => {
      const key = embrioesSubTab === 'doadora' ? e.doadora_id : e.touro_id;
      const nome = embrioesSubTab === 'doadora' ? e.doadora_nome : e.touro_nome;
      if (key && nome) {
        const current = map.get(key) || { nome, count: 0 };
        current.count++;
        map.set(key, current);
      }
    });
    const result: EmbriaoAgrupado[] = [];
    map.forEach((value, id) => result.push({ id, nome: value.nome, count: value.count }));
    result.sort((a, b) => b.count - a.count);
    return result;
  }, [embrioes, embrioesSubTab]);

  const filteredEmbrioes = useMemo(() => {
    return embrioesAgrupados.filter(e => {
      if (!debouncedBotijaoSearch) return true;
      return e.nome?.toLowerCase().includes(debouncedBotijaoSearch.toLowerCase());
    });
  }, [embrioesAgrupados, debouncedBotijaoSearch]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleReservar = (item: { tipo: 'doadora' | 'touro'; data: CatalogoDoadora | CatalogoTouro }) => {
    const d = item.data;
    setReservaAnimal({
      catalogoId: d.catalogo_id,
      tipo: item.tipo,
      nome: ('nome' in d ? d.nome : d.registro) || d.registro,
      registro: d.registro,
      foto: d.foto_principal || d.foto_url,
      preco: d.preco,
    });
  };

  const handleDetalhes = (item: { tipo: 'doadora' | 'touro'; data: CatalogoDoadora | CatalogoTouro }) => {
    navigate(`/genetica/${item.tipo === 'doadora' ? 'doadoras' : 'touros'}/${item.data.catalogo_id}`);
  };

  const handleSubmitReserva = async (data: {
    catalogo_id: string;
    tipo: 'doadora' | 'touro';
    data_desejada?: string;
    quantidade_embrioes?: number;
    observacoes?: string;
  }) => {
    if (!clienteId) {
      toast({ title: 'Erro', description: 'Cliente não identificado', variant: 'destructive' });
      return;
    }
    try {
      await criarReserva.mutateAsync({ ...data, cliente_id: clienteId });
      toast({ title: 'Reserva solicitada!', description: 'Acompanhe o status na aba "Reservas".' });
      setReservaAnimal(null);
      setActiveTab('reservas');
    } catch (err) {
      toast({
        title: 'Erro ao criar reserva',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleCancelar = async (id: string) => {
    if (!clienteId) return;
    setCancelando(id);
    try {
      await cancelarReserva.mutateAsync({ id, clienteId });
      toast({ title: 'Reserva cancelada' });
    } catch (err) {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setCancelando(null);
    }
  };

  if (catalogoLoading && !catalogo) {
    return <LoadingScreen />;
  }

  if (catalogoError || hubError) {
    return (
      <div className="space-y-4 pb-20">
        <PageHeader title="Genética" icon={Dna} />
        <EmptyState
          title="Erro ao carregar dados"
          description="Não foi possível carregar as informações. Verifique sua conexão e tente novamente."
          action={
            <Button variant="outline" size="sm" onClick={() => { refetchCatalogo(); refetchHub(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title="Genética" icon={Dna} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* 3 Tabs premium */}
        <div className="rounded-xl border border-border/60 glass-panel p-1.5 shadow-sm">
          <TabsList className="grid grid-cols-4 h-auto p-0 bg-transparent gap-1.5">
            {/* Catálogo */}
            <TabsTrigger
              value="catalogo"
              aria-label={`Catálogo — ${totalCatalogo} animais`}
              className={cn(
                'relative h-12 gap-1.5 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'catalogo' ? 'bg-primary/15 border-primary/20' : 'bg-muted/50 border-transparent'
              )}>
                <ShoppingBag className={cn('w-4 h-4', activeTab === 'catalogo' ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Catálogo</span>
              <CountBadge
                value={totalCatalogo}
                variant={activeTab === 'catalogo' ? 'primary' : 'default'}
              />
              {activeTab === 'catalogo' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
              )}
            </TabsTrigger>

            {/* Meu Botijão */}
            <TabsTrigger
              value="botijao"
              aria-label={`Meu Botijão — ${totalBotijao} itens`}
              className={cn(
                'relative h-12 gap-1.5 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'botijao' ? 'bg-cyan-500/15 border-cyan-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <Container className={cn('w-4 h-4', activeTab === 'botijao' ? 'text-cyan-500' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Botijão</span>
              {totalBotijao > 0 && (
                <CountBadge
                  value={totalBotijao}
                  variant={activeTab === 'botijao' ? 'cyan' : 'default'}
                />
              )}
              {activeTab === 'botijao' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-cyan-500 rounded-full" />
              )}
            </TabsTrigger>

            {/* Reservas */}
            <TabsTrigger
              value="reservas"
              aria-label={`Reservas${reservasPendentes > 0 ? ` — ${reservasPendentes} pendentes` : ''}`}
              className={cn(
                'relative h-12 gap-1.5 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'reservas' ? 'bg-amber-500/15 border-amber-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <ClipboardList className={cn('w-4 h-4', activeTab === 'reservas' ? 'text-amber-500' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Reservas</span>
              {reservasPendentes > 0 && (
                <CountBadge
                  value={reservasPendentes}
                  variant={activeTab === 'reservas' ? 'warning' : 'default'}
                />
              )}
              {activeTab === 'reservas' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-amber-500 rounded-full" />
              )}
            </TabsTrigger>

            {/* Comunidade */}
            <TabsTrigger
              value="comunidade"
              aria-label="Comunidade — Anúncios de outros usuários"
              className={cn(
                'relative h-12 gap-1.5 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'comunidade' ? 'bg-violet-500/15 border-violet-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <Users className={cn('w-4 h-4', activeTab === 'comunidade' ? 'text-violet-500' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Comunidade</span>
              {activeTab === 'comunidade' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-violet-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ Tab Catálogo ═══ */}
        <TabsContent value="catalogo" className="mt-4 space-y-4">
          <MercadoFilters
            tipo={tipoFilter}
            onTipoChange={setTipoFilter}
            raca={racaFilter}
            onRacaChange={setRacaFilter}
            busca={buscaFilter}
            onBuscaChange={setBuscaFilter}
            doadoras={catalogo?.doadoras || []}
            touros={catalogo?.touros || []}
          />

          {itens.length === 0 ? (
            <EmptyState
              title="Nenhum animal encontrado"
              description={buscaFilter || racaFilter ? 'Nenhum resultado para os filtros aplicados' : 'O catálogo ainda não possui animais publicados'}
              action={(buscaFilter || racaFilter) ? (
                <Button variant="outline" size="sm" onClick={() => { setBuscaFilter(''); setRacaFilter(''); setTipoFilter('todos'); }}>
                  Limpar filtros
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="space-y-2.5">
              {itens.map((item) => {
                const d = item.data;
                const isDoadora = item.tipo === 'doadora';
                const doadora = isDoadora ? (d as CatalogoDoadora) : null;
                const touro = !isDoadora ? (d as CatalogoTouro) : null;

                return (
                  <MercadoAnimalCard
                    key={d.catalogo_id}
                    catalogoId={d.catalogo_id}
                    tipo={item.tipo}
                    nome={'nome' in d ? d.nome : null}
                    registro={d.registro}
                    raca={d.raca}
                    preco={d.preco}
                    fotoUrl={d.foto_url}
                    fotoPrincipal={d.foto_principal}
                    paiNome={d.pai_nome}
                    maeNome={d.mae_nome}
                    estoque={doadora?.embrioes_disponiveis ?? touro?.doses_disponiveis}
                    onReservar={() => handleReservar(item)}
                    onDetalhes={() => handleDetalhes(item)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ Tab Meu Botijão ═══ */}
        <TabsContent value="botijao" className="mt-4 space-y-4">
          {hubLoading ? (
            <LoadingScreen />
          ) : (
            <>
              {/* Sub-tabs: Doses / Embriões */}
              <div className="flex gap-1.5 p-1.5 bg-muted/40 rounded-xl border border-border/40">
                <button
                  onClick={() => setBotijaoSubTab('doses')}
                  className={cn(
                    'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    botijaoSubTab === 'doses'
                      ? 'glass-panel shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center border',
                    botijaoSubTab === 'doses' ? 'bg-indigo-500/15 border-indigo-500/20' : 'bg-muted/50 border-transparent'
                  )}>
                    <SpermIcon className={cn('w-3.5 h-3.5', botijaoSubTab === 'doses' ? 'text-indigo-500' : 'text-muted-foreground')} />
                  </div>
                  <span>Doses</span>
                  <CountBadge
                    value={totalDoses}
                    variant={botijaoSubTab === 'doses' ? 'violet' : 'default'}
                  />
                  {botijaoSubTab === 'doses' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setBotijaoSubTab('embrioes')}
                  className={cn(
                    'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    botijaoSubTab === 'embrioes'
                      ? 'glass-panel shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center border',
                    botijaoSubTab === 'embrioes' ? 'bg-cyan-500/15 border-cyan-500/20' : 'bg-muted/50 border-transparent'
                  )}>
                    <Snowflake className={cn('w-3.5 h-3.5', botijaoSubTab === 'embrioes' ? 'text-cyan-500' : 'text-muted-foreground')} />
                  </div>
                  <span>Embriões</span>
                  <CountBadge
                    value={totalEmbrioes}
                    variant={botijaoSubTab === 'embrioes' ? 'cyan' : 'default'}
                  />
                  {botijaoSubTab === 'embrioes' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cyan-500 rounded-full" />
                  )}
                </button>
              </div>

              {/* Busca */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-primary/70" />
                </div>
                <Input
                  placeholder={botijaoSubTab === 'doses' ? 'Buscar touro...' : 'Buscar...'}
                  value={botijaoSearch}
                  onChange={(e) => setBotijaoSearch(e.target.value)}
                  className="pl-11 h-11 text-base rounded-xl border-border/60 glass-panel shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>

              {/* Conteúdo Doses */}
              {botijaoSubTab === 'doses' && (
                <div className="space-y-2.5">
                  {filteredTouros.length === 0 ? (
                    <EmptyState
                      title="Nenhuma dose"
                      description={botijaoSearch ? 'Nenhum touro encontrado para a busca' : 'Você ainda não possui doses de sêmen'}
                      action={botijaoSearch ? (
                        <Button variant="outline" size="sm" onClick={() => setBotijaoSearch('')}>
                          Limpar busca
                        </Button>
                      ) : undefined}
                    />
                  ) : (
                    filteredTouros.map((touro) => (
                      <TouroCard key={touro.id} data={touro} />
                    ))
                  )}
                </div>
              )}

              {/* Conteúdo Embriões */}
              {botijaoSubTab === 'embrioes' && (
                <div className="space-y-3">
                  {/* Sub-tabs: Por Doadora / Por Touro */}
                  <div className="flex gap-1.5 p-1.5 bg-muted/40 rounded-xl border border-border/40">
                    <button
                      onClick={() => setEmbrioesSubTab('doadora')}
                      className={cn(
                        'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        embrioesSubTab === 'doadora'
                          ? 'glass-panel shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center border',
                        embrioesSubTab === 'doadora' ? 'bg-amber-500/15 border-amber-500/20' : 'bg-muted/50 border-transparent'
                      )}>
                        <DonorCowIcon className={cn('w-3.5 h-3.5', embrioesSubTab === 'doadora' ? 'text-amber-500' : 'text-muted-foreground')} />
                      </div>
                      <span>Por Doadora</span>
                      {embrioesSubTab === 'doadora' && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => setEmbrioesSubTab('touro')}
                      className={cn(
                        'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        embrioesSubTab === 'touro'
                          ? 'glass-panel shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center border',
                        embrioesSubTab === 'touro' ? 'bg-indigo-500/15 border-indigo-500/20' : 'bg-muted/50 border-transparent'
                      )}>
                        <SpermIcon className={cn('w-3.5 h-3.5', embrioesSubTab === 'touro' ? 'text-indigo-500' : 'text-muted-foreground')} />
                      </div>
                      <span>Por Touro</span>
                      {embrioesSubTab === 'touro' && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full" />
                      )}
                    </button>
                  </div>

                  {/* Lista de embriões */}
                  {filteredEmbrioes.length === 0 ? (
                    <EmptyState
                      title="Nenhum embrião"
                      description={botijaoSearch ? 'Nenhum resultado para a busca' : 'Você ainda não possui embriões congelados'}
                      action={botijaoSearch ? (
                        <Button variant="outline" size="sm" onClick={() => setBotijaoSearch('')}>
                          Limpar busca
                        </Button>
                      ) : undefined}
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {filteredEmbrioes.map((item) => (
                        <EmbrioCard key={item.id} data={item} tipo={embrioesSubTab} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ Tab Reservas ═══ */}
        <TabsContent value="reservas" className="mt-4">
          {reservasLoading ? (
            <LoadingScreen />
          ) : (
            <MinhasReservas
              reservas={reservas}
              onCancelar={handleCancelar}
              cancelando={cancelando}
            />
          )}
        </TabsContent>

        {/* ═══ Tab Comunidade (C2C) ═══ */}
        <TabsContent value="comunidade" className="mt-4">
          <MercadoComunitario />
        </TabsContent>
      </Tabs>

      {/* Dialog de reserva */}
      <ReservaDialog
        open={!!reservaAnimal}
        onOpenChange={(open) => !open && setReservaAnimal(null)}
        animal={reservaAnimal}
        onSubmit={handleSubmitReserva}
        loading={criarReserva.isPending}
      />
    </div>
  );
}
