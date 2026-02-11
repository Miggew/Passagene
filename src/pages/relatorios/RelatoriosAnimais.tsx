import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Search, X, Eye, History, FileText, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, MapPin } from 'lucide-react';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { CowIcon } from '@/components/icons/CowIcon';
import { supabase } from '@/lib/supabase';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';
import type { Fazenda } from '@/lib/types';
import { exportRelatorio } from '@/lib/exportPdf';
import { formatDateBR } from '@/lib/dateUtils';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { CalendarCheck } from 'lucide-react';

type TipoAnimal = 'receptoras' | 'doadoras';

interface ReceptoraRow {
  id: string;
  identificacao: string;
  nome?: string;
  status_reprodutivo?: string;
  fazenda_atual_id?: string;
  fazenda_nome?: string;
  is_cio_livre?: boolean;
  data_provavel_parto?: string;
}

interface DoadoraRow {
  id: string;
  registro: string;
  nome?: string;
  raca?: string;
  fazenda_id: string;
  fazenda_nome?: string;
  disponivel_aspiracao?: boolean;
  classificacao_genetica?: string;
  total_aspiracoes: number;
  media_oocitos: number;
  ultima_aspiracao_data?: string;
}

type SortOrder = 'asc' | 'desc' | 'none';

const ITENS_POR_PAGINA = 20;
const DIAS_DESCANSO = 14; // Período mínimo entre aspirações

export default function RelatoriosAnimais() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clienteIdFilter } = useClienteFilter();

  // Tab ativa
  const [tipoAnimal, setTipoAnimal] = useState<TipoAnimal>(
    (searchParams.get('tipo') as TipoAnimal) || 'receptoras'
  );

  // Filtros
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [filtroFazenda, setFiltroFazenda] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('all');
  const [filtroDisponivel, setFiltroDisponivel] = useState('all');
  const [sortByDate, setSortByDate] = useState<SortOrder>('none');
  const [dataAspiracao, setDataAspiracao] = useState<string>('');

  // Dados
  const [receptoras, setReceptoras] = useState<ReceptoraRow[]>([]);
  const [doadoras, setDoadoras] = useState<DoadoraRow[]>([]);
  const [racas, setRacas] = useState<string[]>([]);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(true);

  // Carregar fazendas e raças
  useEffect(() => {
    loadFazendas();
    loadRacas();
  }, [clienteIdFilter]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadData();
    setPaginaAtual(1);
  }, [tipoAnimal, filtroFazenda, filtroStatus, filtroRaca, filtroDisponivel, clienteIdFilter]);

  const loadFazendas = async () => {
    let query = supabase.from('fazendas').select('*').order('nome');
    if (clienteIdFilter) {
      query = query.eq('cliente_id', clienteIdFilter);
    }
    const { data } = await query;
    setFazendas(data ?? []);
  };

  const loadRacas = async () => {
    const { data } = await supabase
      .from('doadoras')
      .select('raca')
      .not('raca', 'is', null);

    const uniqueRacas = [...new Set(data?.map(d => d.raca).filter(Boolean))] as string[];
    setRacas(uniqueRacas.sort());
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Obter IDs das fazendas filtradas
      let fazendaIds: string[] = [];
      if (clienteIdFilter) {
        const { data: clienteFazendas } = await supabase
          .from('fazendas')
          .select('id')
          .eq('cliente_id', clienteIdFilter);
        fazendaIds = clienteFazendas?.map(f => f.id) ?? [];
      }

      if (tipoAnimal === 'receptoras') {
        await loadReceptoras(fazendaIds);
      } else {
        await loadDoadoras(fazendaIds);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceptoras = async (fazendaIds: string[]) => {
    // Buscar receptoras com informações básicas
    let query = supabase
      .from('receptoras')
      .select('id, identificacao, nome, status_reprodutivo, is_cio_livre, data_provavel_parto')
      .order('identificacao');

    // Filtro de status
    if (filtroStatus !== 'all') {
      query = query.eq('status_reprodutivo', filtroStatus);
    }

    const { data: receptorasData } = await query;
    if (!receptorasData || receptorasData.length === 0) {
      setReceptoras([]);
      return;
    }

    // Buscar fazenda atual de cada receptora via view
    const receptoraIds = receptorasData.map(r => r.id);
    const { data: viewData } = await supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
      .in('receptora_id', receptoraIds);

    const fazendaMap = new Map(
      (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
    );

    // Filtrar por fazenda se necessário
    let result = receptorasData.map(r => {
      const fazendaInfo = fazendaMap.get(r.id);
      return {
        id: r.id,
        identificacao: r.identificacao,
        nome: r.nome,
        status_reprodutivo: r.status_reprodutivo,
        fazenda_atual_id: fazendaInfo?.id,
        fazenda_nome: fazendaInfo?.nome ?? 'Sem fazenda',
        is_cio_livre: r.is_cio_livre,
        data_provavel_parto: r.data_provavel_parto,
      };
    });

    // Aplicar filtros de fazenda no resultado
    if (clienteIdFilter && fazendaIds.length > 0) {
      result = result.filter(r => r.fazenda_atual_id && fazendaIds.includes(r.fazenda_atual_id));
    }
    if (filtroFazenda !== 'all') {
      result = result.filter(r => r.fazenda_atual_id === filtroFazenda);
    }

    setReceptoras(result);
  };

  const loadDoadoras = async (fazendaIds: string[]) => {
    let query = supabase
      .from('doadoras')
      .select(`
        id,
        registro,
        nome,
        raca,
        fazenda_id,
        fazendas(nome),
        disponivel_aspiracao,
        classificacao_genetica
      `)
      .order('registro');

    // Filtros
    if (clienteIdFilter && fazendaIds.length > 0) {
      query = query.in('fazenda_id', fazendaIds);
    }
    if (filtroFazenda !== 'all') {
      query = query.eq('fazenda_id', filtroFazenda);
    }
    if (filtroRaca !== 'all') {
      query = query.eq('raca', filtroRaca);
    }
    if (filtroDisponivel !== 'all') {
      query = query.eq('disponivel_aspiracao', filtroDisponivel === 'sim');
    }

    const { data } = await query;

    // Buscar estatísticas de aspirações (incluindo última data)
    const doadoraIds = data?.map(d => d.id) ?? [];
    const { data: aspiracoes } = await supabase
      .from('aspiracoes_doadoras')
      .select('doadora_id, total_oocitos, data_aspiracao')
      .in('doadora_id', doadoraIds);

    const statsMap = new Map<string, { count: number; totalOocitos: number; ultimaData?: string }>();
    aspiracoes?.forEach(a => {
      const current = statsMap.get(a.doadora_id) ?? { count: 0, totalOocitos: 0, ultimaData: undefined };
      const novaData = a.data_aspiracao;
      const ultimaData = current.ultimaData && current.ultimaData > novaData ? current.ultimaData : novaData;
      statsMap.set(a.doadora_id, {
        count: current.count + 1,
        totalOocitos: current.totalOocitos + (a.total_oocitos ?? 0),
        ultimaData,
      });
    });

    setDoadoras(
      data?.map(d => {
        const stats = statsMap.get(d.id);
        return {
          id: d.id,
          registro: d.registro,
          nome: d.nome,
          raca: d.raca,
          fazenda_id: d.fazenda_id,
          fazenda_nome: (d.fazendas as any)?.nome ?? 'N/A',
          disponivel_aspiracao: d.disponivel_aspiracao,
          classificacao_genetica: d.classificacao_genetica,
          total_aspiracoes: stats?.count ?? 0,
          media_oocitos: stats ? Math.round(stats.totalOocitos / stats.count) : 0,
          ultima_aspiracao_data: stats?.ultimaData,
        };
      }) ?? []
    );
  };

  // Dados filtrados por busca e ordenados
  const dadosFiltrados = useMemo(() => {
    let dados: any[] = tipoAnimal === 'receptoras' ? receptoras : doadoras;

    if (filtroBusca.trim()) {
      const busca = filtroBusca.toLowerCase();
      if (tipoAnimal === 'receptoras') {
        dados = dados.filter((r: ReceptoraRow) =>
          r.identificacao?.toLowerCase().includes(busca) ||
          r.nome?.toLowerCase().includes(busca) ||
          r.fazenda_nome?.toLowerCase().includes(busca)
        );
      } else {
        dados = dados.filter((d: DoadoraRow) =>
          d.registro?.toLowerCase().includes(busca) ||
          d.nome?.toLowerCase().includes(busca) ||
          d.fazenda_nome?.toLowerCase().includes(busca)
        );
      }
    }

    // Filtrar por disponibilidade para aspiração (apenas para doadoras)
    if (tipoAnimal === 'doadoras' && dataAspiracao) {
      // Calcula data de corte: data selecionada - 14 dias (parse sem timezone)
      const [y, m, d] = dataAspiracao.split('-').map(Number);
      const dataCorte = new Date(y, m - 1, d - DIAS_DESCANSO);

      dados = dados.filter((doadora: DoadoraRow) => {
        // Se nunca foi aspirada, está disponível
        if (!doadora.ultima_aspiracao_data) return true;
        // Parse da última aspiração sem timezone
        const [ay, am, ad] = doadora.ultima_aspiracao_data.split('-').map(Number);
        const ultimaAsp = new Date(ay, am - 1, ad);
        // Se última aspiração foi até a data de corte (>= 14 dias), está disponível
        return ultimaAsp <= dataCorte;
      });
    }

    // Aplicar ordenação por data (apenas para doadoras)
    if (tipoAnimal === 'doadoras' && sortByDate !== 'none') {
      dados = [...dados].sort((a: DoadoraRow, b: DoadoraRow) => {
        const dateA = a.ultima_aspiracao_data ? new Date(a.ultima_aspiracao_data).getTime() : 0;
        const dateB = b.ultima_aspiracao_data ? new Date(b.ultima_aspiracao_data).getTime() : 0;

        // Itens sem data vão para o final
        if (!a.ultima_aspiracao_data && !b.ultima_aspiracao_data) return 0;
        if (!a.ultima_aspiracao_data) return 1;
        if (!b.ultima_aspiracao_data) return -1;

        return sortByDate === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return dados;
  }, [tipoAnimal, receptoras, doadoras, filtroBusca, sortByDate, dataAspiracao]);

  // Paginação
  const totalPaginas = Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA);
  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return dadosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFiltrados, paginaAtual]);

  const handleLimparFiltros = () => {
    setFiltroFazenda('all');
    setFiltroStatus('all');
    setFiltroRaca('all');
    setFiltroDisponivel('all');
    setFiltroBusca('');
    setSortByDate('none');
    setDataAspiracao('');
    setPaginaAtual(1);
  };

  const handleTabChange = (value: string) => {
    setTipoAnimal(value as TipoAnimal);
    setSearchParams({ tipo: value });
    setPaginaAtual(1);
    // Reset filtros específicos
    setFiltroStatus('all');
    setFiltroRaca('all');
    setFiltroDisponivel('all');
  };

  const getClassificacaoBadge = (classificacao?: string) => {
    if (!classificacao) return '-';
    const labels: Record<string, string> = {
      '1_estrela': '1 Estrela',
      '2_estrelas': '2 Estrelas',
      '3_estrelas': '3 Estrelas',
      'diamante': 'Diamante',
    };
    return labels[classificacao] || classificacao;
  };

  const handleExportPdf = () => {
    if (dadosFiltrados.length === 0) return;

    const fazendaNome = filtroFazenda !== 'all'
      ? fazendas.find(f => f.id === filtroFazenda)?.nome
      : undefined;

    exportRelatorio(tipoAnimal, dadosFiltrados, {
      fazenda: fazendaNome,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Animais"
        description="Consulta de receptoras e doadoras"
      />

      {/* Tabs Premium */}
      <Tabs value={tipoAnimal} onValueChange={handleTabChange}>
        <div className="rounded-xl border border-border bg-card p-1.5">
          <div className="flex gap-1">
            {[
              { value: 'receptoras', label: 'Receptoras', icon: CowIcon },
              { value: 'doadoras', label: 'Doadoras', icon: DonorCowIcon },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
                className={`
                  relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  text-sm font-medium transition-all duration-200
                  ${tipoAnimal === value
                    ? 'bg-muted/80 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }
                `}
              >
                {tipoAnimal === value && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
                )}
                <div className={`
                  flex items-center justify-center w-7 h-7 rounded-md transition-colors
                  ${tipoAnimal === value ? 'bg-primary/15' : 'bg-muted/50'}
                `}>
                  <Icon className={`w-4 h-4 ${tipoAnimal === value ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <span>{label}</span>
                {tipoAnimal === value && dadosFiltrados.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">
                    {dadosFiltrados.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros Premium */}
        <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-stretch">
            {/* Grupo: Busca */}
            <div className="flex items-center px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
              <div className="relative w-full md:min-w-[200px] md:max-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                <Input
                  placeholder={tipoAnimal === 'receptoras' ? 'Buscar identificação, nome...' : 'Buscar registro, nome...'}
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="pl-9 h-11 md:h-9 bg-background/80 border-primary/20 focus:border-primary/40"
                />
              </div>
            </div>

            {/* Grupo: Filtros */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-primary/40" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtros</span>
              </div>

              <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
                <SelectTrigger className="w-full md:w-[160px] h-11 md:h-9 bg-background">
                  <SelectValue placeholder="Fazenda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas fazendas</SelectItem>
                  {fazendas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {tipoAnimal === 'receptoras' && (
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full md:w-[150px] h-11 md:h-9 bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                    <SelectItem value="EM_PROTOCOLO">Em Protocolo</SelectItem>
                    <SelectItem value="PRENHE">Prenhe</SelectItem>
                    <SelectItem value="DESCARTE">Descarte</SelectItem>
                    <SelectItem value="VENDIDA">Vendida</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {tipoAnimal === 'doadoras' && (
                <>
                  <Select value={filtroRaca} onValueChange={setFiltroRaca}>
                    <SelectTrigger className="w-full md:w-[140px] h-11 md:h-9 bg-background">
                      <SelectValue placeholder="Raça" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas raças</SelectItem>
                      {racas.map((raca) => (
                        <SelectItem key={raca} value={raca}>{raca}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filtroDisponivel} onValueChange={setFiltroDisponivel}>
                    <SelectTrigger className="w-full md:w-[140px] h-11 md:h-9 bg-background">
                      <SelectValue placeholder="Disponível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="sim">Disponível</SelectItem>
                      <SelectItem value="nao">Indisponível</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Grupo: Planejamento de aspiração (apenas para doadoras) */}
            {tipoAnimal === 'doadoras' && (
              <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 rounded-full bg-primary/40" />
                  <CalendarCheck className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aptas em</span>
                </div>
                <DatePickerBR
                  value={dataAspiracao}
                  onChange={setDataAspiracao}
                  placeholder="Selecionar data"
                  className="h-11 md:h-9 w-full md:w-[140px] bg-background"
                />
                {dataAspiracao && (
                  <span className="text-[10px] text-muted-foreground">
                    (asp. até {(() => {
                      const [y, m, d] = dataAspiracao.split('-').map(Number);
                      const dataCorte = new Date(y, m - 1, d - DIAS_DESCANSO);
                      return formatDateBR(dataCorte.toISOString());
                    })()})
                  </span>
                )}
              </div>
            )}

            {/* Grupo: Ordenação (apenas para doadoras) */}
            {tipoAnimal === 'doadoras' && (
              <div className="flex items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 rounded-full bg-amber-500/40" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ordenar</span>
                </div>
                <Button
                  variant={sortByDate !== 'none' ? 'default' : 'outline'}
                  size="sm"
                  className="h-11 md:h-8 px-2.5"
                  onClick={() => {
                    // Cicla: none -> desc -> asc -> none
                    if (sortByDate === 'none') setSortByDate('desc');
                    else if (sortByDate === 'desc') setSortByDate('asc');
                    else setSortByDate('none');
                  }}
                  title={sortByDate === 'none' ? 'Ordenar por data' : sortByDate === 'desc' ? 'Mais recentes primeiro' : 'Mais antigas primeiro'}
                >
                  {sortByDate === 'none' && <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />}
                  {sortByDate === 'desc' && <ArrowDown className="w-3.5 h-3.5 mr-1.5" />}
                  {sortByDate === 'asc' && <ArrowUp className="w-3.5 h-3.5 mr-1.5" />}
                  <span className="text-xs">
                    {sortByDate === 'none' && 'Última Asp.'}
                    {sortByDate === 'desc' && 'Recentes'}
                    {sortByDate === 'asc' && 'Antigas'}
                  </span>
                </Button>
              </div>
            )}

            {/* Grupo: Ações */}
            <div className="flex items-center gap-2 px-4 py-3 md:ml-auto bg-gradient-to-b from-muted/50 to-transparent">
              {(filtroBusca || filtroFazenda !== 'all' || filtroStatus !== 'all' || filtroRaca !== 'all' || filtroDisponivel !== 'all' || sortByDate !== 'none' || dataAspiracao) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLimparFiltros}
                  className="h-11 md:h-9 border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => loadData()}
                className="h-11 md:h-9 bg-primary hover:bg-primary-dark shadow-sm shadow-primary/25"
              >
                <Search className="w-4 h-4 mr-1" />
                Buscar
              </Button>
              {dadosFiltrados.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  className="h-11 md:h-9 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo das tabs */}
        <TabsContent value={tipoAnimal} className="mt-4">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : dadosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {dadosPaginados.map((row: ReceptoraRow | DoadoraRow) => (
                <div
                  key={row.id}
                  onClick={() => tipoAnimal === 'receptoras'
                    ? navigate(`/receptoras/${row.id}/historico`)
                    : navigate(`/doadoras/${row.id}`)
                  }
                  className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5 active:bg-muted/30 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-foreground truncate">
                        {tipoAnimal === 'receptoras' ? (row as ReceptoraRow).identificacao : (row as DoadoraRow).registro}
                      </p>
                      {row.nome && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{row.nome}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <MapPin className="w-3 h-3 text-muted-foreground/60" />
                        <span className="text-xs text-muted-foreground truncate">{row.fazenda_nome}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {tipoAnimal === 'receptoras' ? (
                        <>
                          <StatusBadge status={(row as ReceptoraRow).status_reprodutivo || ''} />
                          {(row as ReceptoraRow).is_cio_livre && (
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-md">
                              CL
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {(row as DoadoraRow).raca && (
                            <span className="text-xs text-muted-foreground">{(row as DoadoraRow).raca}</span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-semibold bg-muted text-foreground rounded-md">
                              {(row as DoadoraRow).total_aspiracoes} asp.
                            </span>
                            <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-md">
                              {(row as DoadoraRow).media_oocitos} med.
                            </span>
                          </div>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  </div>
                  {tipoAnimal === 'doadoras' && (row as DoadoraRow).ultima_aspiracao_data && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <span className="text-xs text-muted-foreground">
                        Ult. asp.: {formatDateBR((row as DoadoraRow).ultima_aspiracao_data!)}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Mobile Pagination */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAtual * ITENS_POR_PAGINA, dadosFiltrados.length)}</span>
                    {' '}de{' '}
                    <span className="font-medium text-foreground">{dadosFiltrados.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 h-11 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-muted-foreground">{paginaAtual}/{totalPaginas}</span>
                    <button
                      onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 h-11 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
              {/* Header da tabela com gradiente */}
              <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
                <div className={`grid gap-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ${
                  tipoAnimal === 'receptoras'
                    ? 'grid-cols-[1.5fr_1fr_1.5fr_1fr_0.8fr_0.6fr]'
                    : 'grid-cols-[1fr_0.8fr_1fr_0.8fr_0.8fr_0.6fr_0.6fr_0.5fr]'
                }`}>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-primary/40" />
                    {tipoAnimal === 'receptoras' ? 'Identificação' : 'Registro'}
                  </div>
                  <div className="px-3 py-3">Nome</div>
                  <div className="px-3 py-3">Fazenda</div>
                  {tipoAnimal === 'receptoras' ? (
                    <>
                      <div className="px-3 py-3 text-center">Status</div>
                      <div className="px-3 py-3 text-center">Ciclando</div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-3">Raça</div>
                      <div className="px-3 py-3 text-center">Última Asp.</div>
                      <div className="px-3 py-3 text-center">Aspirações</div>
                      <div className="px-3 py-3 text-center">Média</div>
                    </>
                  )}
                  <div className="px-2 py-3"></div>
                </div>
              </div>

              {/* Linhas da tabela */}
              <div className="divide-y divide-border/50">
                {dadosPaginados.map((row: ReceptoraRow | DoadoraRow, index: number) => (
                  <div
                    key={row.id}
                    onClick={() => tipoAnimal === 'receptoras'
                      ? navigate(`/receptoras/${row.id}/historico`)
                      : navigate(`/doadoras/${row.id}`)
                    }
                    className={`
                      group grid gap-0 items-center cursor-pointer transition-all duration-150
                      hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                      ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                      ${tipoAnimal === 'receptoras'
                        ? 'grid-cols-[1.5fr_1fr_1.5fr_1fr_0.8fr_0.6fr]'
                        : 'grid-cols-[1fr_0.8fr_1fr_0.8fr_0.8fr_0.6fr_0.6fr_0.5fr]'
                      }
                    `}
                  >
                    {/* Coluna principal com indicador */}
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                      <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {tipoAnimal === 'receptoras' ? (row as ReceptoraRow).identificacao : (row as DoadoraRow).registro}
                      </span>
                    </div>

                    {/* Coluna Nome */}
                    <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                      {row.nome || '-'}
                    </div>

                    {/* Coluna Fazenda */}
                    <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                      {row.fazenda_nome}
                    </div>

                    {tipoAnimal === 'receptoras' ? (
                      <>
                        {/* Status */}
                        <div className="px-3 py-3.5 flex justify-center">
                          <StatusBadge status={(row as ReceptoraRow).status_reprodutivo || ''} />
                        </div>
                        {/* Ciclando */}
                        <div className="px-3 py-3.5 flex justify-center">
                          {(row as ReceptoraRow).is_cio_livre ? (
                            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-md group-hover:bg-primary/20 transition-colors">
                              CL
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-medium bg-muted text-muted-foreground rounded-md">
                              N
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Raça */}
                        <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                          {(row as DoadoraRow).raca || '-'}
                        </div>
                        {/* Última Aspiração */}
                        <div className="px-3 py-3.5 text-sm text-center text-muted-foreground">
                          {(row as DoadoraRow).ultima_aspiracao_data
                            ? formatDateBR((row as DoadoraRow).ultima_aspiracao_data!)
                            : '-'}
                        </div>
                        {/* Aspirações */}
                        <div className="px-3 py-3.5 flex justify-center">
                          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold bg-muted text-foreground rounded-md">
                            {(row as DoadoraRow).total_aspiracoes}
                          </span>
                        </div>
                        {/* Média */}
                        <div className="px-3 py-3.5 flex justify-center">
                          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-md group-hover:bg-primary/20 transition-colors">
                            {(row as DoadoraRow).media_oocitos}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Coluna Ação */}
                    <div className="px-2 py-3.5 flex justify-center">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
                        {tipoAnimal === 'receptoras' ? (
                          <History className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação Premium */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAtual * ITENS_POR_PAGINA, dadosFiltrados.length)}</span>
                    {' '}de{' '}
                    <span className="font-medium text-foreground">{dadosFiltrados.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      Anterior
                    </button>
                    <div className="flex items-center gap-0.5 mx-2">
                      {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                        let pageNum;
                        if (totalPaginas <= 5) pageNum = i + 1;
                        else if (paginaAtual <= 3) pageNum = i + 1;
                        else if (paginaAtual >= totalPaginas - 2) pageNum = totalPaginas - 4 + i;
                        else pageNum = paginaAtual - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPaginaAtual(pageNum)}
                            className={`
                              w-8 h-8 text-xs font-medium rounded-md transition-all
                              ${paginaAtual === pageNum
                                ? 'bg-primary/15 text-primary shadow-sm'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }
                            `}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
