import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useTransferenciaEmbrioesData } from '@/hooks/useTransferenciaEmbrioesData';
import { useTransferenciaEmbrioesFilters } from '@/hooks/useTransferenciaEmbrioesFilters';
import { useTransferenciaHandlers } from '@/hooks/useTransferenciaHandlers';
import RelatorioTransferenciaDialog from '@/components/transferencia/RelatorioTransferenciaDialog';
import ReceptorasSelection from '@/components/transferencia/ReceptorasSelection';
import EmbrioesTablePacote from '@/components/transferencia/EmbrioesTablePacote';
import EmbrioesTableCongelados from '@/components/transferencia/EmbrioesTableCongelados';
import {
  ArrowRightLeft,
  Clock,
  Search,
  CalendarDays,
  CheckCircle,
  TrendingUp,
  Eye,
  X,
  Snowflake,
  Package,
  User,
  MapPin,
  Save,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DataTable } from '@/components/shared/DataTable';
import { Switch } from '@/components/ui/switch';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { useToast } from '@/hooks/use-toast';
import {
  TransferenciaFormData,
  CamposPacote,
} from '@/lib/types/transferenciaEmbrioes';

const EMBRIOES_PAGE_SIZE = 20;

// Interface para histórico de TE
interface HistoricoTE {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  fazenda_nome: string;
  fazenda_id?: string;
  data_te: string;
  embriao_identificacao?: string;
  doadora_registro?: string;
  touro_nome?: string;
  tipo_te: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  observacoes?: string;
}

// Interface para sessão de TE agrupada
interface SessaoTE {
  id: string;
  fazenda_nome: string;
  fazenda_id: string;
  data_te: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  total_receptoras: number;
  total_embrioes: number;
  frescos: number;
  congelados: number;
  transferencias: HistoricoTE[];
}

export default function TransferenciaEmbrioes() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados locais do formulário
  const [formData, setFormData] = useState<TransferenciaFormData>({
    fazenda_id: '',
    pacote_id: '',
    protocolo_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  const [camposPacote, setCamposPacote] = useState<CamposPacote>({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Estado de submissão
  const [submitting, setSubmitting] = useState(false);

  // Estados para Histórico
  const [historico, setHistorico] = useState<HistoricoTE[]>([]);
  const [sessoes, setSessoes] = useState<SessaoTE[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [filtroFazendaHist, setFiltroFazendaHist] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [todasFazendas, setTodasFazendas] = useState<{id: string; nome: string}[]>([]);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const ITENS_POR_PAGINA_HISTORICO = 15;

  // Hook de filtros e UI
  const {
    origemEmbriao,
    setOrigemEmbriao,
    filtroClienteId,
    setFiltroClienteId,
    filtroRaca,
    setFiltroRaca,
    dataPasso2,
    setDataPasso2,
    incluirCioLivre,
    setIncluirCioLivre,
    embrioesPage,
    setEmbrioesPage,
    showRelatorioDialog,
    setShowRelatorioDialog,
    relatorioData,
    setRelatorioData,
    isVisualizacaoApenas,
    setIsVisualizacaoApenas,
    resetAll: resetFiltros,
    aplicarFiltrosSessao,
    fecharRelatorio,
  } = useTransferenciaEmbrioesFilters();

  // Hook de dados
  const {
    fazendas,
    clientes,
    pacotes,
    pacotesFiltrados,
    embrioesCongelados,
    receptoras,
    setReceptoras,
    loading,
    loadingCongelados,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    loadFazendas,
    loadPacotes,
    loadClientes,
    loadEmbrioesCongelados,
    carregarReceptorasDaFazenda,
    recarregarReceptoras,
    salvarSessaoNoBanco,
    encerrarSessaoNoBanco,
    restaurarSessaoEmAndamento,
  } = useTransferenciaEmbrioesData({
    dataPasso2,
    incluirCioLivre,
    filtroClienteId,
    filtroRaca,
    formData,
  });

  // Computed values (needed for handlers hook)
  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = useMemo(() => {
    return pacoteSelecionado?.embrioes.filter(e => e.status_atual === 'FRESCO') || [];
  }, [pacoteSelecionado]);
  const hasD8Limite = embrioesDisponiveis.some(e => e.d8_limite);

  const numerosFixosEffectRuns = useRef(0);
  const numerosFixosMap = useMemo(() => {
    if (!formData.pacote_id || !pacoteSelecionado) {
      return new Map<string, number>();
    }
    const ordenados = [...embrioesDisponiveis].sort((a, b) => {
      const doadoraA = a.doadora_registro || '';
      const doadoraB = b.doadora_registro || '';
      if (doadoraA !== doadoraB) return doadoraA.localeCompare(doadoraB);
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dataA !== dataB) return dataA - dataB;
      return (a.id || '').localeCompare(b.id || '');
    });
    const numerosMap = new Map<string, number>();
    ordenados.forEach((embriao, index) => {
      numerosMap.set(embriao.id, index + 1);
    });
    return numerosMap;
  }, [formData.pacote_id, pacoteSelecionado, embrioesDisponiveis]);

  // Hook de handlers
  const {
    handleDescartarReceptora,
    handleSubmit,
    visualizarRelatorioSessao,
    handleEncerrarSessao,
  } = useTransferenciaHandlers({
    formData,
    setFormData,
    origemEmbriao,
    receptoras,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    numerosFixosMap,
    setSubmitting,
    setRelatorioData,
    setShowRelatorioDialog,
    setIsVisualizacaoApenas,
    resetFiltros,
    loadPacotes,
    loadEmbrioesCongelados,
    recarregarReceptoras,
    encerrarSessaoNoBanco,
  });

  // Salvar estado da sessão
  const salvarEstadoSessao = () => {
    const estadoSessao = {
      fazenda_id: formData.fazenda_id,
      pacote_id: formData.pacote_id,
      data_passo2: dataPasso2,
      data_te: formData.data_te,
      veterinario_responsavel: formData.veterinario_responsavel,
      tecnico_responsavel: formData.tecnico_responsavel,
      origem_embriao: origemEmbriao,
      filtro_cliente_id: filtroClienteId,
      filtro_raca: filtroRaca,
      incluir_cio_livre: incluirCioLivre,
      transferenciasSessao,
      transferenciasIdsSessao,
      embrioes_page: embrioesPage,
    };
    void salvarSessaoNoBanco(estadoSessao);
  };

  // Carregar todas as fazendas para o filtro do histórico
  const loadTodasFazendas = async () => {
    const { data } = await supabase
      .from('fazendas')
      .select('id, nome')
      .order('nome');
    setTodasFazendas(data || []);
  };

  // Carregar histórico de TEs
  const loadHistorico = useCallback(async () => {
    try {
      setLoadingHistorico(true);

      // 1. Buscar transferências de embriões
      let query = supabase
        .from('transferencias_embrioes')
        .select(`
          id,
          receptora_id,
          embriao_id,
          data_te,
          tipo_te,
          veterinario_responsavel,
          tecnico_responsavel,
          observacoes,
          status_te,
          embrioes (id, identificacao, classificacao),
          receptoras (id, identificacao, nome)
        `)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false })
        .limit(500);

      // Aplicar filtros de data
      if (filtroDataInicio) {
        query = query.gte('data_te', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('data_te', filtroDataFim);
      }
      if (filtroTipo && filtroTipo !== 'todos') {
        query = query.eq('tipo_te', filtroTipo);
      }

      const { data: transferenciasData, error: transferenciasError } = await query;

      if (transferenciasError) {
        console.error('Erro ao buscar transferências:', transferenciasError);
        throw new Error(transferenciasError.message || 'Erro ao buscar transferências');
      }

      if (!transferenciasData || transferenciasData.length === 0) {
        setHistorico([]);
        setSessoes([]);
        return;
      }

      // 2. Buscar fazenda atual das receptoras via view
      const receptoraIds = [...new Set(transferenciasData.map(t => t.receptora_id).filter(Boolean))];

      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
        .in('receptora_id', receptoraIds);

      if (viewError) {
        console.error('Erro ao buscar view receptoras:', viewError);
      }

      const fazendaMap = new Map(
        (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
      );

      // 3. Buscar dados de genealogia dos embriões
      const embriaoIds = transferenciasData.map(t => t.embriao_id).filter(Boolean);

      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id')
        .in('id', embriaoIds);

      const acasalamentoIds = (embrioesData || [])
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);

      // Buscar dados de doadoras e touros
      let doadorasMap = new Map<string, string>();
      let tourosMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lotes_fiv_acasalamentos')
          .select(`
            id,
            doadoras (registro),
            touros (nome)
          `)
          .in('id', acasalamentoIds);

        (acasalamentosData || []).forEach(a => {
          if (a.doadoras?.registro) {
            doadorasMap.set(a.id, a.doadoras.registro);
          }
          if (a.touros?.nome) {
            tourosMap.set(a.id, a.touros.nome);
          }
        });
      }

      // Criar mapa de embriao_id para acasalamento_id
      const embriaoAcasalamentoMap = new Map(
        (embrioesData || []).map(e => [e.id, e.lote_fiv_acasalamento_id])
      );

      // 4. Montar histórico formatado
      const historicoFormatado: HistoricoTE[] = transferenciasData.map(te => {
        const fazendaInfo = fazendaMap.get(te.receptora_id);
        const acasalamentoId = embriaoAcasalamentoMap.get(te.embriao_id);

        return {
          id: te.id,
          receptora_id: te.receptora_id,
          receptora_brinco: te.receptoras?.identificacao || '-',
          receptora_nome: te.receptoras?.nome,
          fazenda_nome: fazendaInfo?.nome || '-',
          fazenda_id: fazendaInfo?.id,
          data_te: te.data_te,
          embriao_identificacao: te.embrioes?.identificacao,
          doadora_registro: acasalamentoId ? doadorasMap.get(acasalamentoId) : undefined,
          touro_nome: acasalamentoId ? tourosMap.get(acasalamentoId) : undefined,
          tipo_te: te.tipo_te,
          veterinario_responsavel: te.veterinario_responsavel,
          tecnico_responsavel: te.tecnico_responsavel,
          observacoes: te.observacoes,
        };
      });

      setHistorico(historicoFormatado);

      // 5. Agrupar por sessão (fazenda + data_te + veterinário)
      const sessoesMap = new Map<string, SessaoTE>();

      historicoFormatado.forEach(te => {
        const chave = `${te.fazenda_nome}|${te.data_te}|${te.veterinario_responsavel || ''}`;

        if (!sessoesMap.has(chave)) {
          sessoesMap.set(chave, {
            id: chave,
            fazenda_nome: te.fazenda_nome,
            fazenda_id: te.fazenda_id || '',
            data_te: te.data_te,
            veterinario_responsavel: te.veterinario_responsavel,
            tecnico_responsavel: te.tecnico_responsavel,
            total_receptoras: 0,
            total_embrioes: 0,
            frescos: 0,
            congelados: 0,
            transferencias: [],
          });
        }

        const sessao = sessoesMap.get(chave)!;
        sessao.total_embrioes++;
        sessao.transferencias.push(te);

        if (te.tipo_te === 'FRESCO') sessao.frescos++;
        else if (te.tipo_te === 'CONGELADO') sessao.congelados++;

        // Atualizar técnico se não tiver
        if (!sessao.tecnico_responsavel && te.tecnico_responsavel) {
          sessao.tecnico_responsavel = te.tecnico_responsavel;
        }
      });

      // Calcular total de receptoras únicas por sessão
      sessoesMap.forEach(sessao => {
        const receptorasUnicas = new Set(sessao.transferencias.map(t => t.receptora_id));
        sessao.total_receptoras = receptorasUnicas.size;
      });

      // Ordenar sessões por data de TE (mais recente primeiro)
      const sessoesArray = Array.from(sessoesMap.values()).sort((a, b) => {
        return (b.data_te || '').localeCompare(a.data_te || '');
      });

      setSessoes(sessoesArray);
      setPaginaHistorico(1);
    } catch (error) {
      console.error('Erro no loadHistorico:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar histórico',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingHistorico(false);
    }
  }, [filtroDataInicio, filtroDataFim, filtroTipo, toast]);

  // Local handlers
  const handleFazendaChange = async (fazendaId: string) => {
    if (!fazendaId) {
      setFormData({
        ...formData,
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
      });
      setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setReceptoras([]);
      return;
    }

    setTransferenciasSessao([]);
    setTransferenciasIdsSessao([]);
    setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });

    await carregarReceptorasDaFazenda(fazendaId);
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      pacote_id: '',
      protocolo_id: '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });
  };

  const handlePacoteChange = (pacoteId: string) => {
    const pacote = pacotes.find(p => p.id === pacoteId);

    if (pacote?.pacote_info?.veterinario_responsavel && !formData.veterinario_responsavel) {
      setFormData(prev => ({
        ...prev,
        pacote_id: pacoteId,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
      setCamposPacote(prev => ({
        ...prev,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, pacote_id: pacoteId }));
    }
  };

  const handleLimparFiltrosHistorico = () => {
    setFiltroBusca('');
    setFiltroFazendaHist('todos');
    setFiltroTipo('todos');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setPaginaHistorico(1);
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Effects
  useEffect(() => {
    const carregarDados = async () => {
      await Promise.all([loadFazendas(), loadPacotes(), loadClientes(), loadTodasFazendas()]);
      const sessaoRestaurada = await restaurarSessaoEmAndamento();
      if (sessaoRestaurada) {
        aplicarFiltrosSessao(sessaoRestaurada.filtros);
        setCamposPacote(sessaoRestaurada.camposPacote);
        setFormData(prev => ({
          ...prev,
          ...sessaoRestaurada.formData,
          embriao_id: '',
          receptora_id: '',
          protocolo_receptora_id: '',
          observacoes: '',
        }));
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.protocolo_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, incluirCioLivre, transferenciasSessao.length, transferenciasIdsSessao.length, embrioesPage]);

  useEffect(() => {
    void loadFazendas();
  }, [dataPasso2]);

  useEffect(() => {
    if (formData.fazenda_id) {
      carregarReceptorasDaFazenda(formData.fazenda_id);
    }
  }, [formData.fazenda_id, dataPasso2, incluirCioLivre]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim())) {
      loadEmbrioesCongelados();
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    setEmbrioesPage(1);
  }, [formData.pacote_id]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO') {
      setEmbrioesPage(1);
      setFormData(prev => ({ ...prev, embriao_id: '' }));
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    if (!formData.pacote_id || !pacoteSelecionado) return;
    numerosFixosEffectRuns.current += 1;
  }, [formData.pacote_id, pacoteSelecionado, numerosFixosMap]);

  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
    if (embrioesPage > totalPaginas) {
      setEmbrioesPage(totalPaginas);
    }
  }, [embrioesDisponiveis.length, embrioesPage]);

  // Filtrar sessões do histórico
  const sessoesFiltradas = sessoes.filter(s => {
    const matchesBusca = !filtroBusca ||
      s.fazenda_nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      s.veterinario_responsavel?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      s.transferencias.some(t =>
        t.receptora_brinco.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        t.receptora_nome?.toLowerCase().includes(filtroBusca.toLowerCase())
      );
    const matchesFazenda = filtroFazendaHist === 'todos' || s.fazenda_nome === filtroFazendaHist;

    return matchesBusca && matchesFazenda;
  });

  // Paginação do histórico
  const totalPaginasHistorico = Math.ceil(sessoesFiltradas.length / ITENS_POR_PAGINA_HISTORICO);
  const sessoesPaginadas = sessoesFiltradas.slice(
    (paginaHistorico - 1) * ITENS_POR_PAGINA_HISTORICO,
    paginaHistorico * ITENS_POR_PAGINA_HISTORICO
  );

  // Estatísticas baseadas nas sessões filtradas
  const estatisticasHistorico = sessoesFiltradas.reduce(
    (acc, s) => ({
      sessoes: acc.sessoes + 1,
      receptoras: acc.receptoras + s.total_receptoras,
      embrioes: acc.embrioes + s.total_embrioes,
      frescos: acc.frescos + s.frescos,
      congelados: acc.congelados + s.congelados,
    }),
    { sessoes: 0, receptoras: 0, embrioes: 0, frescos: 0, congelados: 0 }
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferência de Embriões (TE)"
        description="Destinar embriões para receptoras sincronizadas"
      />

      {/* ==================== SESSÃO DE TE ==================== */}
      <div className="mt-4">
          {/* Barra de controles premium */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
            <div className="flex flex-wrap items-end gap-6">
              {/* Grupo: Responsáveis */}
              <div className="flex items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                  <User className="w-3.5 h-3.5" />
                  <span>Responsáveis</span>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Veterinário *
                  </label>
                  <Input
                    placeholder="Nome do veterinário"
                    value={formData.veterinario_responsavel}
                    onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Técnico
                  </label>
                  <Input
                    placeholder="Nome do técnico"
                    value={formData.tecnico_responsavel}
                    onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden lg:block" />

              {/* Grupo: Local */}
              <div className="flex items-end gap-3">
                <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Local</span>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Fazenda *
                  </label>
                  <Select
                    value={formData.fazenda_id}
                    onValueChange={handleFazendaChange}
                    disabled={!formData.veterinario_responsavel}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a fazenda" />
                    </SelectTrigger>
                    <SelectContent>
                      {fazendas.map((fazenda) => (
                        <SelectItem key={fazenda.id} value={fazenda.id}>
                          {fazenda.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[140px] flex-shrink-0">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                    Data TE *
                  </label>
                  <DatePickerBR
                    value={formData.data_te}
                    onChange={(value) => setFormData({ ...formData, data_te: value || '' })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="h-10 w-px bg-border hidden lg:block" />

              {/* Grupo: Ações da Sessão */}
              {formData.fazenda_id && transferenciasIdsSessao.length > 0 && (
                <div className="flex items-end gap-2 ml-auto">
                  <Button
                    type="button"
                    onClick={visualizarRelatorioSessao}
                    variant="outline"
                    disabled={submitting}
                    className="h-9"
                    title="Visualizar relatório da sessão atual"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver ({transferenciasIdsSessao.length})
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEncerrarSessao}
                    disabled={submitting}
                    className="h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {submitting ? 'Encerrando...' : `Encerrar (${transferenciasIdsSessao.length})`}
                  </Button>
                </div>
              )}
            </div>

            {/* Segunda linha de controles */}
            {formData.fazenda_id && (
              <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-border/50">
                {/* Grupo: Filtros de Receptoras */}
                <div className="flex items-end gap-3">
                  <div className="w-1 h-6 rounded-full bg-blue-500/40 self-center" />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Receptoras</span>
                  </div>
                  <div className="w-[130px]">
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                      Data 2º Passo
                    </label>
                    <DatePickerBR
                      value={dataPasso2}
                      onChange={(value) => setDataPasso2(value || '')}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 h-9 self-end">
                    <Switch
                      id="incluir-cio-livre"
                      checked={incluirCioLivre}
                      onCheckedChange={setIncluirCioLivre}
                    />
                    <Label htmlFor="incluir-cio-livre" className="cursor-pointer text-xs">
                      Incluir CIO livre
                    </Label>
                  </div>
                </div>

                {/* Separador */}
                <div className="h-10 w-px bg-border hidden lg:block" />

                {/* Grupo: Origem do Embrião */}
                <div className="flex items-end gap-3">
                  <div className="w-1 h-6 rounded-full bg-amber-500/40 self-center" />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                    <Package className="w-3.5 h-3.5" />
                    <span>Origem</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={origemEmbriao === 'PACOTE' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('PACOTE')}
                      size="sm"
                      className="h-8"
                    >
                      <Package className="w-3.5 h-3.5 mr-1.5" />
                      Pacote
                    </Button>
                    <Button
                      type="button"
                      variant={origemEmbriao === 'CONGELADO' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('CONGELADO')}
                      size="sm"
                      className="h-8"
                    >
                      <Snowflake className="w-3.5 h-3.5 mr-1.5" />
                      Congelado
                    </Button>
                  </div>
                </div>

                {/* Seleção de Pacote */}
                {origemEmbriao === 'PACOTE' && (
                  <div className="flex-1 min-w-[220px] max-w-[300px]">
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                      Pacote de Embriões *
                    </label>
                    <Select value={formData.pacote_id} onValueChange={handlePacoteChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o pacote" />
                      </SelectTrigger>
                      <SelectContent>
                        {pacotesFiltrados.map((pacote) => (
                          <SelectItem key={pacote.id} value={pacote.id}>
                            {pacote.pacote_info?.fazenda_nome || 'N/A'} - {formatDate(pacote.data_despacho)} ({pacote.frescos} frescos)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Filtros para Congelados */}
                {origemEmbriao === 'CONGELADO' && (
                  <>
                    <div className="flex-1 min-w-[160px] max-w-[200px]">
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                        Cliente
                      </label>
                      <Select value={filtroClienteId} onValueChange={setFiltroClienteId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[140px] max-w-[160px]">
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                        Raça
                      </label>
                      <Input
                        value={filtroRaca}
                        onChange={(e) => setFiltroRaca(e.target.value)}
                        placeholder="Digite a raça"
                        className="h-9"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mensagem de ajuda */}
            {!formData.veterinario_responsavel ? (
              <p className="text-xs text-muted-foreground mt-3">
                Preencha o veterinário para selecionar a fazenda
              </p>
            ) : !formData.fazenda_id ? (
              <p className="text-xs text-muted-foreground mt-3">
                Selecione uma fazenda para ver as receptoras disponíveis
              </p>
            ) : null}
          </div>

          {/* Conteúdo principal do formulário */}
          {formData.fazenda_id && (
            <form onSubmit={handleSubmit}>
              {/* Grid com Receptoras à esquerda e Embriões à direita */}
              {(formData.pacote_id || (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim()))) && (
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Coluna Esquerda - Receptoras */}
                      <div className="flex flex-col">
                        <h3 className="text-sm font-semibold text-foreground mb-2">Receptoras</h3>
                        <div className="flex-1 min-h-[300px] max-h-[400px]">
                          <ReceptorasSelection
                            receptoras={receptoras}
                            selectedReceptoraId={formData.receptora_id}
                            contagemSessaoPorReceptora={contagemSessaoPorReceptora}
                            submitting={submitting}
                            onSelectReceptora={(receptoraId, protocoloReceptoraId) => {
                              setFormData({
                                ...formData,
                                receptora_id: receptoraId,
                                protocolo_receptora_id: protocoloReceptoraId,
                              });
                            }}
                            onDescartarReceptora={handleDescartarReceptora}
                          />
                        </div>
                      </div>

                      {/* Coluna Direita - Embriões */}
                      <div className="flex flex-col">
                        <h3 className="text-sm font-semibold text-foreground mb-2">
                          Embriões {origemEmbriao === 'PACOTE' ? '(Pacote)' : '(Congelados)'}
                        </h3>
                        <div className="flex-1 min-h-[300px] max-h-[400px]">
                          {/* Embriões do Pacote */}
                          {origemEmbriao === 'PACOTE' && formData.pacote_id && pacoteSelecionado && (
                            <EmbrioesTablePacote
                              pacote={pacoteSelecionado}
                              embrioes={embrioesDisponiveis}
                              numerosFixosMap={numerosFixosMap}
                              selectedEmbriaoId={formData.embriao_id}
                              embrioesPage={embrioesPage}
                              hasD8Limite={hasD8Limite}
                              onSelectEmbriao={(embriaoId) => setFormData({ ...formData, embriao_id: embriaoId })}
                              onPageChange={setEmbrioesPage}
                            />
                          )}

                          {/* Embriões Congelados */}
                          {origemEmbriao === 'CONGELADO' && (
                            <EmbrioesTableCongelados
                              embrioes={embrioesCongelados}
                              selectedEmbriaoId={formData.embriao_id}
                              embrioesPage={embrioesPage}
                              loadingCongelados={loadingCongelados}
                              filtroClienteId={filtroClienteId}
                              filtroRaca={filtroRaca}
                              onSelectEmbriao={(embriaoId) => setFormData({ ...formData, embriao_id: embriaoId })}
                              onPageChange={setEmbrioesPage}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Campo de Observações e Botão de Submit */}
              {formData.embriao_id && formData.receptora_id && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <Label htmlFor="observacoes" className="text-xs font-medium text-muted-foreground mb-1 block">
                          Observações
                        </Label>
                        <Textarea
                          id="observacoes"
                          value={formData.observacoes}
                          onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                          placeholder="Observações sobre a transferência"
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="h-10 bg-primary hover:bg-primary-dark"
                      >
                        {submitting ? 'Registrando...' : 'Registrar Transferência'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </form>
          )}
        </div>

      {/* Dialog do Relatório */}
      <RelatorioTransferenciaDialog
        open={showRelatorioDialog}
        onOpenChange={setShowRelatorioDialog}
        relatorioData={relatorioData}
        fazendaNome={fazendas.find(f => f.id === formData.fazenda_id)?.nome || 'N/A'}
        dataTe={formData.data_te}
        veterinarioResponsavel={formData.veterinario_responsavel}
        tecnicoResponsavel={formData.tecnico_responsavel}
        isVisualizacaoApenas={isVisualizacaoApenas}
        submitting={submitting}
        onFechar={fecharRelatorio}
        onConfirmarEncerrar={handleEncerrarSessao}
      />
    </div>
  );
}
