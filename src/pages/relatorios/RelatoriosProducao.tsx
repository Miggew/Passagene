import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Eye, Calendar, TrendingUp, Activity, Percent, FileText, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Fazenda } from '@/lib/types';
import { exportRelatorio } from '@/lib/exportPdf';

interface LoteFivRow {
  id: string;
  codigo: string;
  data_abertura: string;
  fazenda_nome: string;
  total_oocitos: number;
  total_embrioes: number;
  taxa_sucesso: number;
  status: string;
}

interface MetricasGerais {
  totalLotes: number;
  totalOocitos: number;
  totalEmbrioes: number;
  taxaMediaSucesso: number;
  totalAspiracoes: number;
  totalProtocolos: number;
}

const ITENS_POR_PAGINA = 15;

export default function RelatoriosProducao() {
  const navigate = useNavigate();
  const { clienteIdFilter } = useClienteFilter();

  // Filtros
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [filtroFazenda, setFiltroFazenda] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Dados
  const [lotes, setLotes] = useState<LoteFivRow[]>([]);
  const [metricas, setMetricas] = useState<MetricasGerais>({
    totalLotes: 0,
    totalOocitos: 0,
    totalEmbrioes: 0,
    taxaMediaSucesso: 0,
    totalAspiracoes: 0,
    totalProtocolos: 0,
  });

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(true);

  // Carregar fazendas
  useEffect(() => {
    loadFazendas();
  }, [clienteIdFilter]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadData();
    setPaginaAtual(1);
  }, [filtroFazenda, filtroStatus, filtroDataInicio, filtroDataFim, clienteIdFilter]);

  const loadFazendas = async () => {
    let query = supabase.from('fazendas').select('*').order('nome');
    if (clienteIdFilter) {
      query = query.eq('cliente_id', clienteIdFilter);
    }
    const { data } = await query;
    setFazendas(data ?? []);
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

      await Promise.all([
        loadLotesFiv(fazendaIds),
        loadMetricas(fazendaIds),
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLotesFiv = async (fazendaIds: string[]) => {
    // Buscar lotes FIV diretamente
    let query = supabase
      .from('lotes_fiv')
      .select('*')
      .order('data_abertura', { ascending: false });

    if (filtroStatus !== 'all') {
      query = query.eq('status', filtroStatus);
    }
    if (filtroDataInicio) {
      query = query.gte('data_abertura', filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte('data_abertura', filtroDataFim);
    }

    const { data: lotesData, error } = await query;

    if (error) {
      console.error('Erro ao carregar lotes:', error);
      setLotes([]);
      return;
    }

    if (!lotesData || lotesData.length === 0) {
      setLotes([]);
      return;
    }

    // Buscar pacotes de aspiração para obter fazenda
    const pacoteIds = [...new Set(lotesData.map(l => l.pacote_aspiracao_id).filter(Boolean))];

    let pacoteMap = new Map<string, any>();
    if (pacoteIds.length > 0) {
      const { data: pacotes } = await supabase
        .from('pacotes_aspiracao')
        .select('id, fazenda_id, fazendas(nome)')
        .in('id', pacoteIds);

      pacotes?.forEach(p => pacoteMap.set(p.id, p));
    }

    // Filtrar por fazenda se necessário
    let lotesFiltrados = lotesData;
    if (filtroFazenda !== 'all') {
      lotesFiltrados = lotesData.filter(l => {
        const pacote = pacoteMap.get(l.pacote_aspiracao_id);
        return pacote?.fazenda_id === filtroFazenda;
      });
    } else if (clienteIdFilter && fazendaIds.length > 0) {
      lotesFiltrados = lotesData.filter(l => {
        const pacote = pacoteMap.get(l.pacote_aspiracao_id);
        return pacote?.fazenda_id && fazendaIds.includes(pacote.fazenda_id);
      });
    }

    const loteIds = lotesFiltrados.map(l => l.id);
    const pacoteIdsFiltrados = [...new Set(lotesFiltrados.map(l => l.pacote_aspiracao_id).filter(Boolean))];

    // Buscar total de oócitos por pacote (via aspirações_doadoras)
    const oocitosPorPacote = new Map<string, number>();
    if (pacoteIdsFiltrados.length > 0) {
      const { data: oocitosData } = await supabase
        .from('aspiracoes_doadoras')
        .select('pacote_aspiracao_id, total_oocitos')
        .in('pacote_aspiracao_id', pacoteIdsFiltrados);

      oocitosData?.forEach(o => {
        const current = oocitosPorPacote.get(o.pacote_aspiracao_id) ?? 0;
        oocitosPorPacote.set(o.pacote_aspiracao_id, current + (o.total_oocitos ?? 0));
      });
    }

    // Buscar total de embriões por lote
    const embrioesPorLote = new Map<string, number>();
    if (loteIds.length > 0) {
      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select('lote_fiv_id')
        .in('lote_fiv_id', loteIds);

      embrioesData?.forEach(e => {
        embrioesPorLote.set(e.lote_fiv_id, (embrioesPorLote.get(e.lote_fiv_id) ?? 0) + 1);
      });
    }

    setLotes(
      lotesFiltrados.map(l => {
        const pacote = pacoteMap.get(l.pacote_aspiracao_id);
        const totalOocitos = oocitosPorPacote.get(l.pacote_aspiracao_id) ?? 0;
        const totalEmbrioes = embrioesPorLote.get(l.id) ?? 0;
        const taxaSucesso = totalOocitos > 0 ? Math.round((totalEmbrioes / totalOocitos) * 100) : 0;

        return {
          id: l.id,
          codigo: l.codigo,
          data_abertura: l.data_abertura,
          fazenda_nome: (pacote?.fazendas as any)?.nome ?? 'N/A',
          total_oocitos: totalOocitos,
          total_embrioes: totalEmbrioes,
          taxa_sucesso: taxaSucesso,
          status: l.status,
        };
      })
    );
  };

  const loadMetricas = async (fazendaIds: string[]) => {
    // Período padrão: últimos 90 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90);
    const dataLimiteStr = format(dataLimite, 'yyyy-MM-dd');

    // Queries em paralelo
    const [lotesResult, aspiracoesResult, protocolosResult] = await Promise.all([
      // Total de lotes FIV
      supabase
        .from('lotes_fiv')
        .select('id, pacote_aspiracao_id', { count: 'exact' })
        .gte('data_abertura', dataLimiteStr),

      // Total de aspirações
      clienteIdFilter && fazendaIds.length > 0
        ? supabase
          .from('pacotes_aspiracao')
          .select('id', { count: 'exact' })
          .in('fazenda_id', fazendaIds)
          .gte('data_aspiracao', dataLimiteStr)
        : supabase
          .from('pacotes_aspiracao')
          .select('id', { count: 'exact' })
          .gte('data_aspiracao', dataLimiteStr),

      // Total de protocolos
      clienteIdFilter && fazendaIds.length > 0
        ? supabase
          .from('protocolos_sincronizacao')
          .select('id', { count: 'exact' })
          .in('fazenda_id', fazendaIds)
          .gte('data_inicio', dataLimiteStr)
        : supabase
          .from('protocolos_sincronizacao')
          .select('id', { count: 'exact' })
          .gte('data_inicio', dataLimiteStr),
    ]);

    // Calcular totais de oócitos e embriões
    const pacoteIds = lotesResult.data?.map(l => l.pacote_aspiracao_id) ?? [];
    const loteIds = lotesResult.data?.map(l => l.id) ?? [];

    let totalOocitos = 0;
    let totalEmbrioes = 0;

    if (pacoteIds.length > 0) {
      const { data: oocitosData } = await supabase
        .from('aspiracoes_doadoras')
        .select('total_oocitos')
        .in('pacote_aspiracao_id', pacoteIds);

      totalOocitos = oocitosData?.reduce((acc, o) => acc + (o.total_oocitos ?? 0), 0) ?? 0;
    }

    if (loteIds.length > 0) {
      const { count } = await supabase
        .from('embrioes')
        .select('id', { count: 'exact', head: true })
        .in('lote_fiv_id', loteIds);

      totalEmbrioes = count ?? 0;
    }

    const taxaMediaSucesso = totalOocitos > 0 ? Math.round((totalEmbrioes / totalOocitos) * 100) : 0;

    setMetricas({
      totalLotes: lotesResult.count ?? 0,
      totalOocitos,
      totalEmbrioes,
      taxaMediaSucesso,
      totalAspiracoes: aspiracoesResult.count ?? 0,
      totalProtocolos: protocolosResult.count ?? 0,
    });
  };

  // Dados filtrados por busca
  const dadosFiltrados = useMemo(() => {
    if (!filtroBusca.trim()) return lotes;

    const busca = filtroBusca.toLowerCase();
    return lotes.filter(l =>
      l.codigo?.toLowerCase().includes(busca) ||
      l.fazenda_nome?.toLowerCase().includes(busca)
    );
  }, [lotes, filtroBusca]);

  // Paginação
  const totalPaginas = Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA);
  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return dadosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFiltrados, paginaAtual]);

  const handleLimparFiltros = () => {
    setFiltroFazenda('all');
    setFiltroStatus('all');
    setFiltroBusca('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setPaginaAtual(1);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINALIZADO':
        return <Badge className="bg-primary hover:bg-primary-dark">Finalizado</Badge>;
      case 'EM_ANDAMENTO':
        return <Badge variant="secondary">Em Andamento</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTaxaBadge = (taxa: number) => {
    let color = 'bg-red-500/15 text-red-600 dark:text-red-400';
    if (taxa >= 40) color = 'bg-primary/15 text-primary';
    else if (taxa >= 25) color = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

    return (
      <span className={`inline-flex items-center justify-center min-w-10 h-6 px-2 text-xs font-semibold rounded ${color}`}>
        {taxa}%
      </span>
    );
  };

  const handleExportPdf = () => {
    if (dadosFiltrados.length === 0) return;

    const fazendaNome = filtroFazenda !== 'all'
      ? fazendas.find(f => f.id === filtroFazenda)?.nome
      : undefined;

    const periodo = filtroDataInicio || filtroDataFim
      ? `${filtroDataInicio ? formatDate(filtroDataInicio) : '...'} a ${filtroDataFim ? formatDate(filtroDataFim) : '...'}`
      : undefined;

    exportRelatorio('lotesFiv', dadosFiltrados, {
      fazenda: fazendaNome,
      periodo,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Produção"
        description="Métricas de produção e lotes de FIV"
      />

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : metricas.totalLotes}
                </p>
                <p className="text-xs text-muted-foreground">Lotes FIV (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : metricas.totalOocitos.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Oócitos (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : metricas.totalEmbrioes.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Embriões (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Percent className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : `${metricas.taxaMediaSucesso}%`}
                </p>
                <p className="text-xs text-muted-foreground">Taxa Média</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Activity className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : metricas.totalAspiracoes}
                </p>
                <p className="text-xs text-muted-foreground">Aspirações (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Activity className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : metricas.totalProtocolos}
                </p>
                <p className="text-xs text-muted-foreground">Protocolos (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          {/* Busca */}
          <div className="relative w-full md:flex-1 md:min-w-[200px] md:max-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou fazenda..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-9 h-11 md:h-9"
            />
          </div>

          <div className="h-px w-full md:h-6 md:w-px bg-border hidden md:block" />

          {/* Fazenda */}
          <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
            <SelectTrigger className="w-full md:w-[180px] h-11 md:h-9">
              <SelectValue placeholder="Fazenda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fazendas</SelectItem>
              {fazendas.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full md:w-[150px] h-11 md:h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="FINALIZADO">Finalizado</SelectItem>
              <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-px w-full md:h-6 md:w-px bg-border hidden md:block" />

          {/* Período */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">de</span>
              <DatePickerBR
                value={filtroDataInicio}
                onChange={setFiltroDataInicio}
                className="h-11 md:h-8 flex-1 md:w-[120px] text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">até</span>
              <DatePickerBR
                value={filtroDataFim}
                onChange={setFiltroDataFim}
                className="h-11 md:h-8 flex-1 md:w-[120px] text-xs"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 md:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparFiltros}
              className="h-11 md:h-9"
            >
              <X className="w-4 h-4" />
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

      {/* Tabela de Lotes FIV */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lotes FIV ({dadosFiltrados.length})</CardTitle>
          <CardDescription>Histórico de lotes de fertilização in vitro</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <LoadingSpinner />
          ) : dadosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lote encontrado
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-2">
                {dadosPaginados.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => navigate(`/lotes-fiv/${row.id}`)}
                    className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5 active:bg-muted/30 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-foreground truncate">
                          {row.codigo}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{row.fazenda_nome}</p>
                        <span className="text-xs text-muted-foreground">{formatDate(row.data_abertura)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {getStatusBadge(row.status)}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Oócitos</span>
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-medium bg-muted text-foreground rounded">
                          {row.total_oocitos}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Embriões</span>
                        <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-medium bg-primary/15 text-primary rounded">
                          {row.total_embrioes}
                        </span>
                      </div>
                      <div className="ml-auto">
                        {getTaxaBadge(row.taxa_sucesso)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_0.6fr] gap-0 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="px-4 py-3">Código</div>
                  <div className="px-3 py-3">Fazenda</div>
                  <div className="px-3 py-3 text-center">Data FIV</div>
                  <div className="px-3 py-3 text-center">Oócitos</div>
                  <div className="px-3 py-3 text-center">Embriões</div>
                  <div className="px-3 py-3 text-center">Taxa</div>
                  <div className="px-3 py-3 text-center">Status</div>
                  <div className="px-2 py-3"></div>
                </div>
                {dadosPaginados.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_0.6fr] gap-0 items-center border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/lotes-fiv/${row.id}`)}
                  >
                    <div className="px-4 py-3 font-medium text-sm">{row.codigo}</div>
                    <div className="px-3 py-3 text-sm text-muted-foreground truncate">{row.fazenda_nome}</div>
                    <div className="px-3 py-3 text-sm text-center">{formatDate(row.data_abertura)}</div>
                    <div className="px-3 py-3 flex justify-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-medium bg-muted text-foreground rounded">
                        {row.total_oocitos}
                      </span>
                    </div>
                    <div className="px-3 py-3 flex justify-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-medium bg-primary/15 text-primary rounded">
                        {row.total_embrioes}
                      </span>
                    </div>
                    <div className="px-3 py-3 flex justify-center">{getTaxaBadge(row.taxa_sucesso)}</div>
                    <div className="px-3 py-3 flex justify-center">{getStatusBadge(row.status)}</div>
                    <div className="px-2 py-3 flex justify-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Visualizar">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <>
                  {/* Mobile Pagination */}
                  <div className="md:hidden flex items-center justify-between mt-4 pt-4 border-t border-border">
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

                  {/* Desktop Pagination */}
                  <div className="hidden md:flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {((paginaAtual - 1) * ITENS_POR_PAGINA) + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, dadosFiltrados.length)} de {dadosFiltrados.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                        disabled={paginaAtual === 1}
                      >
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                          let pageNum;
                          if (totalPaginas <= 5) pageNum = i + 1;
                          else if (paginaAtual <= 3) pageNum = i + 1;
                          else if (paginaAtual >= totalPaginas - 2) pageNum = totalPaginas - 4 + i;
                          else pageNum = paginaAtual - 2 + i;

                          return (
                            <Button
                              key={pageNum}
                              variant={paginaAtual === pageNum ? 'default' : 'outline'}
                              size="sm"
                              className={`w-9 h-9 p-0 ${paginaAtual === pageNum ? 'bg-primary hover:bg-primary-dark' : ''}`}
                              onClick={() => setPaginaAtual(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                        disabled={paginaAtual === totalPaginas}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
