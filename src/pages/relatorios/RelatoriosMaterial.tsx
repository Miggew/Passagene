import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, Snowflake, FileText } from 'lucide-react';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { supabase } from '@/lib/supabase';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Cliente } from '@/lib/types';
import { exportRelatorio, pdfConfigs } from '@/lib/exportPdf';

type TipoMaterial = 'embrioes' | 'semen';

interface EmbriaoRow {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  doadora_registro?: string;
  doadora_nome?: string;
  touro_nome?: string;
  qualidade?: number;
  estadio?: string;
  data_congelamento?: string;
  quantidade: number;
}

interface DoseSemenRow {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  touro_nome: string;
  touro_registro?: string;
  tipo_semen: string;
  quantidade_disponivel: number;
  partida?: string;
  data_aquisicao?: string;
}

const ITENS_POR_PAGINA = 20;

export default function RelatoriosMaterial() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { clienteIdFilter } = useClienteFilter();

  // Tab ativa
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterial>(
    (searchParams.get('tipo') as TipoMaterial) || 'embrioes'
  );

  // Filtros
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtroCliente, setFiltroCliente] = useState('all');
  const [filtroTouro, setFiltroTouro] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroQualidade, setFiltroQualidade] = useState('all');

  // Dados
  const [embrioes, setEmbrioes] = useState<EmbriaoRow[]>([]);
  const [dosesSemen, setDosesSemen] = useState<DoseSemenRow[]>([]);
  const [touros, setTouros] = useState<{ id: string; nome: string }[]>([]);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(true);

  // Carregar clientes e touros
  useEffect(() => {
    loadClientes();
    loadTouros();
  }, [clienteIdFilter]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadData();
    setPaginaAtual(1);
  }, [tipoMaterial, filtroCliente, filtroTouro, filtroTipo, filtroQualidade, clienteIdFilter]);

  const loadClientes = async () => {
    // Se for cliente, não precisa carregar lista
    if (clienteIdFilter) {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteIdFilter);
      setClientes(data ?? []);
      return;
    }

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    setClientes(data ?? []);
  };

  const loadTouros = async () => {
    const { data } = await supabase
      .from('touros')
      .select('id, nome')
      .order('nome');
    setTouros(data ?? []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (tipoMaterial === 'embrioes') {
        await loadEmbrioes();
      } else {
        await loadDosesSemen();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmbrioes = async () => {
    // Buscar embriões congelados com relacionamentos
    let query = supabase
      .from('embrioes')
      .select(`
        id,
        cliente_id,
        classificacao,
        tipo_embriao,
        data_congelamento,
        cliente:clientes(id, nome),
        acasalamento:lote_fiv_acasalamentos(
          id,
          dose_semen:doses_semen(
            touro:touros(id, nome)
          ),
          aspiracao:aspiracoes_doadoras(
            doadora:doadoras(id, registro, nome)
          )
        )
      `)
      .eq('status_atual', 'CONGELADO')
      .order('data_congelamento', { ascending: false });

    // Filtros
    if (clienteIdFilter) {
      query = query.eq('cliente_id', clienteIdFilter);
    } else if (filtroCliente !== 'all') {
      query = query.eq('cliente_id', filtroCliente);
    }

    const { data } = await query;

    // Processar dados e agrupar por doadora/touro/qualidade
    const processedEmbrioes: EmbriaoRow[] = [];
    const groupMap = new Map<string, EmbriaoRow>();

    data?.forEach(e => {
      const acasalamento = e.acasalamento as any;
      const doadora = acasalamento?.aspiracao?.doadora;
      const touro = acasalamento?.dose_semen?.touro;
      const cliente = e.cliente as any;

      // Agrupar por cliente + doadora + touro + classificação
      const groupKey = `${e.cliente_id}-${doadora?.id || 'sem'}-${touro?.id || 'sem'}-${e.classificacao || 'sem'}`;

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.quantidade++;
      } else {
        groupMap.set(groupKey, {
          id: e.id,
          cliente_id: e.cliente_id || '',
          cliente_nome: cliente?.nome ?? 'N/A',
          doadora_registro: doadora?.registro,
          doadora_nome: doadora?.nome,
          touro_nome: touro?.nome,
          qualidade: e.classificacao ? parseInt(e.classificacao) : undefined,
          estadio: e.tipo_embriao,
          data_congelamento: e.data_congelamento,
          quantidade: 1,
        });
      }
    });

    // Aplicar filtro de touro localmente (pois vem de relacionamento)
    let result = Array.from(groupMap.values());
    if (filtroTouro !== 'all') {
      result = result.filter(e => e.touro_nome?.toLowerCase().includes(filtroTouro.toLowerCase()));
    }
    if (filtroQualidade !== 'all') {
      result = result.filter(e => e.qualidade === parseInt(filtroQualidade));
    }

    setEmbrioes(result);
  };

  const loadDosesSemen = async () => {
    let query = supabase
      .from('doses_semen')
      .select('*')
      .gt('quantidade', 0)
      .order('created_at', { ascending: false });

    // Filtros
    if (clienteIdFilter) {
      query = query.eq('cliente_id', clienteIdFilter);
    } else if (filtroCliente !== 'all') {
      query = query.eq('cliente_id', filtroCliente);
    }

    if (filtroTouro !== 'all') {
      query = query.eq('touro_id', filtroTouro);
    }

    if (filtroTipo !== 'all') {
      query = query.eq('tipo_semen', filtroTipo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar doses:', error);
      setDosesSemen([]);
      return;
    }

    if (!data || data.length === 0) {
      setDosesSemen([]);
      return;
    }

    // Buscar nomes dos clientes e touros separadamente
    const clienteIds = [...new Set(data.map(d => d.cliente_id).filter(Boolean))];
    const touroIds = [...new Set(data.map(d => d.touro_id).filter(Boolean))];

    const [clientesResult, tourosResult] = await Promise.all([
      clienteIds.length > 0
        ? supabase.from('clientes').select('id, nome').in('id', clienteIds)
        : Promise.resolve({ data: [] }),
      touroIds.length > 0
        ? supabase.from('touros').select('id, nome, registro').in('id', touroIds)
        : Promise.resolve({ data: [] }),
    ]);

    const clientesMap = new Map<string, string>();
    const tourosMap = new Map<string, { nome: string; registro?: string }>();

    clientesResult.data?.forEach(c => clientesMap.set(c.id, c.nome));
    tourosResult.data?.forEach(t => tourosMap.set(t.id, { nome: t.nome, registro: t.registro }));

    setDosesSemen(
      data.map(d => ({
        id: d.id,
        cliente_id: d.cliente_id,
        cliente_nome: clientesMap.get(d.cliente_id) ?? 'N/A',
        touro_nome: tourosMap.get(d.touro_id)?.nome ?? 'N/A',
        touro_registro: tourosMap.get(d.touro_id)?.registro,
        tipo_semen: d.tipo_semen,
        quantidade_disponivel: d.quantidade ?? 0,
        partida: d.partida,
        data_aquisicao: d.data_aquisicao,
      }))
    );
  };

  // Dados filtrados por busca
  const dadosFiltrados = useMemo(() => {
    let dados: any[] = tipoMaterial === 'embrioes' ? embrioes : dosesSemen;

    if (filtroBusca.trim()) {
      const busca = filtroBusca.toLowerCase();
      if (tipoMaterial === 'embrioes') {
        dados = dados.filter((e: EmbriaoRow) =>
          e.doadora_registro?.toLowerCase().includes(busca) ||
          e.doadora_nome?.toLowerCase().includes(busca) ||
          e.touro_nome?.toLowerCase().includes(busca) ||
          e.cliente_nome?.toLowerCase().includes(busca)
        );
      } else {
        dados = dados.filter((d: DoseSemenRow) =>
          d.touro_nome?.toLowerCase().includes(busca) ||
          d.touro_registro?.toLowerCase().includes(busca) ||
          d.cliente_nome?.toLowerCase().includes(busca) ||
          d.partida?.toLowerCase().includes(busca)
        );
      }
    }

    return dados;
  }, [tipoMaterial, embrioes, dosesSemen, filtroBusca]);

  // Totais
  const totais = useMemo(() => {
    if (tipoMaterial === 'embrioes') {
      return {
        registros: dadosFiltrados.length,
        quantidade: dadosFiltrados.reduce((acc, e) => acc + (e.quantidade || 0), 0),
      };
    } else {
      return {
        registros: dadosFiltrados.length,
        quantidade: dadosFiltrados.reduce((acc, d) => acc + (d.quantidade_disponivel || 0), 0),
      };
    }
  }, [tipoMaterial, dadosFiltrados]);

  // Paginação
  const totalPaginas = Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA);
  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return dadosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFiltrados, paginaAtual]);

  const handleLimparFiltros = () => {
    setFiltroCliente('all');
    setFiltroTouro('all');
    setFiltroTipo('all');
    setFiltroQualidade('all');
    setFiltroBusca('');
    setPaginaAtual(1);
  };

  const handleTabChange = (value: string) => {
    setTipoMaterial(value as TipoMaterial);
    setSearchParams({ tipo: value });
    setPaginaAtual(1);
    // Reset filtros específicos
    setFiltroTipo('all');
    setFiltroQualidade('all');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getQualidadeBadge = (qualidade?: number) => {
    if (!qualidade) return '-';
    const colors: Record<number, string> = {
      1: 'bg-primary/15 text-primary',
      2: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      3: 'bg-red-500/15 text-red-600 dark:text-red-400',
    };
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded ${colors[qualidade] || 'bg-muted text-foreground'}`}>
        {qualidade}
      </span>
    );
  };

  const getTipoSemenBadge = (tipo: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      'convencional': { label: 'Conv.', color: 'bg-muted text-foreground' },
      'sexado_femea': { label: 'Sexado F', color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
      'sexado_macho': { label: 'Sexado M', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    };
    const config = labels[tipo] || { label: tipo, color: 'bg-muted text-foreground' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleExportPdf = () => {
    if (dadosFiltrados.length === 0) return;

    const configMap: Record<TipoMaterial, keyof typeof pdfConfigs> = {
      embrioes: 'embrioes',
      semen: 'dosesSemen',
    };

    exportRelatorio(configMap[tipoMaterial], dadosFiltrados, {});
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Material Genético"
        description="Estoque de embriões congelados e doses de sêmen"
      />

      {/* Tabs */}
      <Tabs value={tipoMaterial} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="embrioes" className="flex items-center gap-2">
            <Snowflake className="w-4 h-4" />
            Embriões Congelados
          </TabsTrigger>
          <TabsTrigger value="semen" className="flex items-center gap-2">
            <SpermIcon className="w-4 h-4" />
            Doses de Sêmen
          </TabsTrigger>
        </TabsList>

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card p-4 mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            {/* Busca */}
            <div className="relative w-full md:flex-1 md:min-w-[200px] md:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tipoMaterial === 'embrioes' ? 'Buscar por doadora ou touro...' : 'Buscar por touro ou partida...'}
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="pl-9 h-11 md:h-9"
              />
            </div>

            <div className="h-px w-full md:h-6 md:w-px bg-border hidden md:block" />

            {/* Cliente (somente para admin/operacional) */}
            {!clienteIdFilter && (
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="w-full md:w-[180px] h-11 md:h-9">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Touro */}
            <Select value={filtroTouro} onValueChange={setFiltroTouro}>
              <SelectTrigger className="w-full md:w-[180px] h-11 md:h-9">
                <SelectValue placeholder="Touro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os touros</SelectItem>
                {touros.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtros específicos de Embriões */}
            {tipoMaterial === 'embrioes' && (
              <Select value={filtroQualidade} onValueChange={setFiltroQualidade}>
                <SelectTrigger className="w-full md:w-[130px] h-11 md:h-9">
                  <SelectValue placeholder="Qualidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="1">Grau 1</SelectItem>
                  <SelectItem value="2">Grau 2</SelectItem>
                  <SelectItem value="3">Grau 3</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Filtros específicos de Sêmen */}
            {tipoMaterial === 'semen' && (
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-full md:w-[150px] h-11 md:h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="convencional">Convencional</SelectItem>
                  <SelectItem value="sexado_femea">Sexado Fêmea</SelectItem>
                  <SelectItem value="sexado_macho">Sexado Macho</SelectItem>
                </SelectContent>
              </Select>
            )}

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

          {/* Totais */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{totais.registros}</strong> registros
            </span>
            <span className="text-sm text-muted-foreground">
              <strong className="text-primary">{totais.quantidade}</strong> {tipoMaterial === 'embrioes' ? 'embriões' : 'doses'} no total
            </span>
          </div>
        </div>

        {/* Conteúdo das tabs */}
        <TabsContent value={tipoMaterial} className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tipoMaterial === 'embrioes' && `Embriões Congelados (${dadosFiltrados.length})`}
                {tipoMaterial === 'semen' && `Doses de Sêmen (${dadosFiltrados.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : dadosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </div>
              ) : (
                <>
                  {/* Mobile Cards - Embriões */}
                  {tipoMaterial === 'embrioes' && (
                    <div className="md:hidden space-y-2">
                      {dadosPaginados.map((row: EmbriaoRow) => (
                        <div key={row.id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-medium text-foreground truncate">
                                {row.doadora_registro || 'Sem registro'}
                              </p>
                              {row.doadora_nome && (
                                <p className="text-xs text-muted-foreground truncate">{row.doadora_nome}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                Touro: {row.touro_nome || '-'}
                              </p>
                              {!clienteIdFilter && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {row.cliente_nome}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="inline-flex items-center justify-center min-w-8 h-7 px-2 text-sm font-semibold bg-primary/15 text-primary rounded-lg">
                                {row.quantidade}
                              </span>
                              {getQualidadeBadge(row.qualidade)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
                            <span className="text-xs text-muted-foreground">{row.estadio || '-'}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(row.data_congelamento)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Desktop Table - Embriões */}
                  {tipoMaterial === 'embrioes' && (
                    <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                      <div className="grid grid-cols-[1.5fr_1.2fr_1.2fr_0.7fr_0.7fr_1fr_0.7fr] gap-0 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {!clienteIdFilter && <div className="px-4 py-3">Cliente</div>}
                        <div className={`px-3 py-3 ${clienteIdFilter ? 'px-4' : ''}`}>Doadora</div>
                        <div className="px-3 py-3">Touro</div>
                        <div className="px-3 py-3 text-center">Qual.</div>
                        <div className="px-3 py-3 text-center">Estádio</div>
                        <div className="px-3 py-3 text-center">Congelamento</div>
                        <div className="px-3 py-3 text-center">Qtd</div>
                      </div>
                      {dadosPaginados.map((row: EmbriaoRow) => (
                        <div
                          key={row.id}
                          className={`grid gap-0 items-center border-t border-border hover:bg-muted/30 ${
                            clienteIdFilter
                              ? 'grid-cols-[1.2fr_1.2fr_0.7fr_0.7fr_1fr_0.7fr]'
                              : 'grid-cols-[1.5fr_1.2fr_1.2fr_0.7fr_0.7fr_1fr_0.7fr]'
                          }`}
                        >
                          {!clienteIdFilter && (
                            <div className="px-4 py-3 text-sm truncate">{row.cliente_nome}</div>
                          )}
                          <div className={`py-3 ${clienteIdFilter ? 'px-4' : 'px-3'}`}>
                            <div className="text-sm font-medium">{row.doadora_registro || '-'}</div>
                            {row.doadora_nome && (
                              <div className="text-xs text-muted-foreground">{row.doadora_nome}</div>
                            )}
                          </div>
                          <div className="px-3 py-3 text-sm truncate">{row.touro_nome || '-'}</div>
                          <div className="px-3 py-3 flex justify-center">{getQualidadeBadge(row.qualidade)}</div>
                          <div className="px-3 py-3 text-center text-sm">{row.estadio || '-'}</div>
                          <div className="px-3 py-3 text-center text-sm">{formatDate(row.data_congelamento)}</div>
                          <div className="px-3 py-3 flex justify-center">
                            <span className="inline-flex items-center justify-center min-w-8 h-7 px-2 text-sm font-semibold bg-primary/15 text-primary rounded-lg">
                              {row.quantidade}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mobile Cards - Doses de Sêmen */}
                  {tipoMaterial === 'semen' && (
                    <div className="md:hidden space-y-2">
                      {dadosPaginados.map((row: DoseSemenRow) => (
                        <div key={row.id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-medium text-foreground truncate">
                                {row.touro_nome}
                              </p>
                              {row.touro_registro && (
                                <p className="text-xs text-muted-foreground truncate">{row.touro_registro}</p>
                              )}
                              {!clienteIdFilter && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {row.cliente_nome}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="inline-flex items-center justify-center min-w-8 h-7 px-2 text-sm font-semibold bg-primary/15 text-primary rounded-lg">
                                {row.quantidade_disponivel}
                              </span>
                              {getTipoSemenBadge(row.tipo_semen)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
                            {row.partida && <span className="text-xs text-muted-foreground">Partida: {row.partida}</span>}
                            <span className="text-xs text-muted-foreground">{formatDate(row.data_aquisicao)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Desktop Table - Doses de Sêmen */}
                  {tipoMaterial === 'semen' && (
                    <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                      <div className={`grid gap-0 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                        clienteIdFilter
                          ? 'grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr]'
                          : 'grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr]'
                      }`}>
                        {!clienteIdFilter && <div className="px-4 py-3">Cliente</div>}
                        <div className={`px-3 py-3 ${clienteIdFilter ? 'px-4' : ''}`}>Touro</div>
                        <div className="px-3 py-3 text-center">Tipo</div>
                        <div className="px-3 py-3">Partida</div>
                        <div className="px-3 py-3 text-center">Aquisição</div>
                        <div className="px-3 py-3 text-center">Qtd</div>
                      </div>
                      {dadosPaginados.map((row: DoseSemenRow) => (
                        <div
                          key={row.id}
                          className={`grid gap-0 items-center border-t border-border hover:bg-muted/30 ${
                            clienteIdFilter
                              ? 'grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr]'
                              : 'grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr]'
                          }`}
                        >
                          {!clienteIdFilter && (
                            <div className="px-4 py-3 text-sm truncate">{row.cliente_nome}</div>
                          )}
                          <div className={`py-3 ${clienteIdFilter ? 'px-4' : 'px-3'}`}>
                            <div className="text-sm font-medium">{row.touro_nome}</div>
                            {row.touro_registro && (
                              <div className="text-xs text-muted-foreground">{row.touro_registro}</div>
                            )}
                          </div>
                          <div className="px-3 py-3 flex justify-center">{getTipoSemenBadge(row.tipo_semen)}</div>
                          <div className="px-3 py-3 text-sm">{row.partida || '-'}</div>
                          <div className="px-3 py-3 text-center text-sm">{formatDate(row.data_aquisicao)}</div>
                          <div className="px-3 py-3 flex justify-center">
                            <span className="inline-flex items-center justify-center min-w-8 h-7 px-2 text-sm font-semibold bg-primary/15 text-primary rounded-lg">
                              {row.quantidade_disponivel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
