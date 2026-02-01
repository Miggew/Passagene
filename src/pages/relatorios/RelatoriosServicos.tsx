import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  Search,
  X,
  Eye,
  Syringe,
  TestTube,
  ArrowRightLeft,
  ThumbsUp,
  FileText,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import { supabase } from '@/lib/supabase';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Fazenda } from '@/lib/types';
import { exportRelatorio, pdfConfigs } from '@/lib/exportPdf';

type TipoServico = 'protocolos' | 'aspiracoes' | 'te' | 'dg' | 'sexagem';

interface ProtocoloRow {
  id: string;
  fazenda_id: string;
  fazenda_nome: string;
  data_inicio: string;
  veterinario_responsavel?: string;
  status: string;
  total_receptoras: number;
}

interface AspiracaoRow {
  id: string;
  fazenda_id: string;
  fazenda_nome: string;
  data_aspiracao: string;
  veterinario_responsavel?: string;
  status: string;
  total_doadoras: number;
}

interface SessaoRow {
  id: string;
  fazenda_id: string;
  fazenda_nome: string;
  data: string;
  veterinario_responsavel?: string;
  total_registros: number;
}

const ITENS_POR_PAGINA = 15;

export default function RelatoriosServicos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clienteIdFilter } = useClienteFilter();

  // Tab ativa (pode vir da URL)
  const [tipoServico, setTipoServico] = useState<TipoServico>(
    (searchParams.get('tipo') as TipoServico) || 'protocolos'
  );

  // Filtros
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [filtroFazenda, setFiltroFazenda] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDataTipo, setFiltroDataTipo] = useState<'data_inicio' | 'passo2_data'>('data_inicio');

  // Dados
  const [protocolos, setProtocolos] = useState<ProtocoloRow[]>([]);
  const [aspiracoes, setAspiracoes] = useState<AspiracaoRow[]>([]);
  const [sessoesTe, setSessoesTe] = useState<SessaoRow[]>([]);
  const [sessoesDg, setSessoesDg] = useState<SessaoRow[]>([]);
  const [sessoesSexagem, setSessoesSexagem] = useState<SessaoRow[]>([]);

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
  }, [tipoServico, filtroFazenda, filtroStatus, filtroDataInicio, filtroDataFim, filtroDataTipo, clienteIdFilter]);

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

      switch (tipoServico) {
        case 'protocolos':
          await loadProtocolos(fazendaIds);
          break;
        case 'aspiracoes':
          await loadAspiracoes(fazendaIds);
          break;
        case 'te':
          await loadSessoesTe(fazendaIds);
          break;
        case 'dg':
          await loadSessoesDg(fazendaIds);
          break;
        case 'sexagem':
          await loadSessoesSexagem(fazendaIds);
          break;
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProtocolos = async (fazendaIds: string[]) => {
    let query = supabase
      .from('protocolos_sincronizacao')
      .select('id, fazenda_id, data_inicio, responsavel_inicio, status')
      .order('data_inicio', { ascending: false });

    // Filtros
    if (clienteIdFilter && fazendaIds.length > 0) {
      query = query.in('fazenda_id', fazendaIds);
    }
    if (filtroFazenda !== 'all') {
      query = query.eq('fazenda_id', filtroFazenda);
    }
    if (filtroStatus !== 'all') {
      query = query.eq('status', filtroStatus);
    }
    // Usar campo de data conforme seleção do usuário
    const campoData = filtroDataTipo === 'passo2_data' ? 'passo2_data' : 'data_inicio';
    if (filtroDataInicio) {
      query = query.gte(campoData, filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte(campoData, filtroDataFim);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      setProtocolos([]);
      return;
    }

    // Buscar nomes das fazendas
    const fazendaIdsUnicos = [...new Set(data.map(p => p.fazenda_id))];
    const { data: fazendasData } = await supabase
      .from('fazendas')
      .select('id, nome')
      .in('id', fazendaIdsUnicos);

    const fazendaNomeMap = new Map(
      (fazendasData || []).map(f => [f.id, f.nome])
    );

    // Buscar contagem de receptoras por protocolo
    const protocoloIds = data.map(p => p.id);
    const { data: receptorasCounts } = await supabase
      .from('protocolo_receptoras')
      .select('protocolo_id')
      .in('protocolo_id', protocoloIds);

    const countsMap = new Map<string, number>();
    receptorasCounts?.forEach(r => {
      countsMap.set(r.protocolo_id, (countsMap.get(r.protocolo_id) ?? 0) + 1);
    });

    setProtocolos(
      data.map(p => ({
        id: p.id,
        fazenda_id: p.fazenda_id,
        fazenda_nome: fazendaNomeMap.get(p.fazenda_id) ?? 'N/A',
        data_inicio: p.data_inicio,
        veterinario_responsavel: p.responsavel_inicio,
        status: p.status,
        total_receptoras: countsMap.get(p.id) ?? 0,
      }))
    );
  };

  const loadAspiracoes = async (fazendaIds: string[]) => {
    let query = supabase
      .from('pacotes_aspiracao')
      .select('id, fazenda_id, data_aspiracao, veterinario_responsavel, status')
      .order('data_aspiracao', { ascending: false });

    if (clienteIdFilter && fazendaIds.length > 0) {
      query = query.in('fazenda_id', fazendaIds);
    }
    if (filtroFazenda !== 'all') {
      query = query.eq('fazenda_id', filtroFazenda);
    }
    if (filtroStatus !== 'all') {
      query = query.eq('status', filtroStatus);
    }
    if (filtroDataInicio) {
      query = query.gte('data_aspiracao', filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte('data_aspiracao', filtroDataFim);
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      setAspiracoes([]);
      return;
    }

    // Buscar nomes das fazendas
    const fazendaIdsUnicos = [...new Set(data.map(p => p.fazenda_id))];
    const { data: fazendasData } = await supabase
      .from('fazendas')
      .select('id, nome')
      .in('id', fazendaIdsUnicos);

    const fazendaNomeMap = new Map(
      (fazendasData || []).map(f => [f.id, f.nome])
    );

    // Buscar contagem de doadoras
    const pacoteIds = data.map(p => p.id);
    const { data: doadorasCounts } = await supabase
      .from('aspiracoes_doadoras')
      .select('pacote_aspiracao_id')
      .in('pacote_aspiracao_id', pacoteIds);

    const countsMap = new Map<string, number>();
    doadorasCounts?.forEach(d => {
      countsMap.set(d.pacote_aspiracao_id, (countsMap.get(d.pacote_aspiracao_id) ?? 0) + 1);
    });

    setAspiracoes(
      data.map(p => ({
        id: p.id,
        fazenda_id: p.fazenda_id,
        fazenda_nome: fazendaNomeMap.get(p.fazenda_id) ?? 'N/A',
        data_aspiracao: p.data_aspiracao,
        veterinario_responsavel: p.veterinario_responsavel,
        status: p.status,
        total_doadoras: countsMap.get(p.id) ?? 0,
      }))
    );
  };

  const loadSessoesTe = async (fazendaIds: string[]) => {
    // Buscar transferências realizadas
    let query = supabase
      .from('transferencias_embrioes')
      .select(`
        id,
        data_te,
        veterinario_responsavel,
        receptora_id
      `)
      .eq('status_te', 'REALIZADA')
      .order('data_te', { ascending: false });

    if (filtroDataInicio) {
      query = query.gte('data_te', filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte('data_te', filtroDataFim);
    }

    const { data: transferencias } = await query;
    if (!transferencias || transferencias.length === 0) {
      setSessoesTe([]);
      return;
    }

    // Buscar fazenda das receptoras via view
    const receptoraIds = [...new Set(transferencias.map(t => t.receptora_id).filter(Boolean))];
    const { data: viewData } = await supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
      .in('receptora_id', receptoraIds);

    const fazendaMap = new Map(
      (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
    );

    // Agrupar transferências por fazenda + data_te + veterinario (sessões virtuais)
    const sessoesMap = new Map<string, {
      fazenda_id: string;
      fazenda_nome: string;
      data: string;
      veterinario_responsavel?: string;
      count: number;
    }>();

    transferencias.forEach(t => {
      const fazendaInfo = fazendaMap.get(t.receptora_id);
      if (!fazendaInfo) return;

      // Aplicar filtros de fazenda
      if (clienteIdFilter && fazendaIds.length > 0 && !fazendaIds.includes(fazendaInfo.id)) return;
      if (filtroFazenda !== 'all' && fazendaInfo.id !== filtroFazenda) return;

      const key = `${fazendaInfo.id}|${t.data_te}|${t.veterinario_responsavel || ''}`;
      const existing = sessoesMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        sessoesMap.set(key, {
          fazenda_id: fazendaInfo.id,
          fazenda_nome: fazendaInfo.nome,
          data: t.data_te,
          veterinario_responsavel: t.veterinario_responsavel || undefined,
          count: 1,
        });
      }
    });

    // Converter para array e ordenar
    const sessoesArray = Array.from(sessoesMap.entries()).map(([key, value]) => ({
      id: key,
      fazenda_id: value.fazenda_id,
      fazenda_nome: value.fazenda_nome,
      data: value.data,
      veterinario_responsavel: value.veterinario_responsavel,
      total_registros: value.count,
    }));

    sessoesArray.sort((a, b) => b.data.localeCompare(a.data));
    setSessoesTe(sessoesArray);
  };

  const loadSessoesDg = async (fazendaIds: string[]) => {
    // Buscar diagnósticos de gestação (tipo DG)
    let query = supabase
      .from('diagnosticos_gestacao')
      .select(`
        id,
        receptora_id,
        data_te,
        data_diagnostico,
        veterinario_responsavel
      `)
      .eq('tipo_diagnostico', 'DG')
      .order('data_diagnostico', { ascending: false });

    if (filtroDataInicio) {
      query = query.gte('data_diagnostico', filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte('data_diagnostico', filtroDataFim);
    }

    const { data: diagnosticos } = await query;
    if (!diagnosticos || diagnosticos.length === 0) {
      setSessoesDg([]);
      return;
    }

    // Buscar fazenda das receptoras via view
    const receptoraIds = [...new Set(diagnosticos.map(d => d.receptora_id).filter(Boolean))];
    const { data: viewData } = await supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
      .in('receptora_id', receptoraIds);

    const fazendaMap = new Map(
      (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
    );

    // Agrupar diagnósticos por fazenda + data_te + data_diagnostico + veterinario (sessões virtuais)
    const sessoesMap = new Map<string, {
      fazenda_id: string;
      fazenda_nome: string;
      data_te: string;
      data_diagnostico: string;
      veterinario_responsavel?: string;
      count: number;
    }>();

    diagnosticos.forEach(d => {
      const fazendaInfo = fazendaMap.get(d.receptora_id);
      if (!fazendaInfo) return;

      // Aplicar filtros de fazenda
      if (clienteIdFilter && fazendaIds.length > 0 && !fazendaIds.includes(fazendaInfo.id)) return;
      if (filtroFazenda !== 'all' && fazendaInfo.id !== filtroFazenda) return;

      const key = `${fazendaInfo.id}|${d.data_te}|${d.data_diagnostico}|${d.veterinario_responsavel || ''}`;
      const existing = sessoesMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        sessoesMap.set(key, {
          fazenda_id: fazendaInfo.id,
          fazenda_nome: fazendaInfo.nome,
          data_te: d.data_te,
          data_diagnostico: d.data_diagnostico,
          veterinario_responsavel: d.veterinario_responsavel || undefined,
          count: 1,
        });
      }
    });

    // Converter para array e ordenar por data de diagnóstico
    const sessoesArray = Array.from(sessoesMap.entries()).map(([key, value]) => ({
      id: key,
      fazenda_id: value.fazenda_id,
      fazenda_nome: value.fazenda_nome,
      data: value.data_diagnostico,
      veterinario_responsavel: value.veterinario_responsavel,
      total_registros: value.count,
    }));

    sessoesArray.sort((a, b) => b.data.localeCompare(a.data));
    setSessoesDg(sessoesArray);
  };

  const loadSessoesSexagem = async (fazendaIds: string[]) => {
    // Buscar diagnósticos de sexagem (tipo SEXAGEM)
    let query = supabase
      .from('diagnosticos_gestacao')
      .select(`
        id,
        receptora_id,
        data_te,
        data_diagnostico,
        veterinario_responsavel
      `)
      .eq('tipo_diagnostico', 'SEXAGEM')
      .order('data_diagnostico', { ascending: false });

    if (filtroDataInicio) {
      query = query.gte('data_diagnostico', filtroDataInicio);
    }
    if (filtroDataFim) {
      query = query.lte('data_diagnostico', filtroDataFim);
    }

    const { data: diagnosticos } = await query;
    if (!diagnosticos || diagnosticos.length === 0) {
      setSessoesSexagem([]);
      return;
    }

    // Buscar fazenda das receptoras via view
    const receptoraIds = [...new Set(diagnosticos.map(d => d.receptora_id).filter(Boolean))];
    const { data: viewData } = await supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
      .in('receptora_id', receptoraIds);

    const fazendaMap = new Map(
      (viewData || []).map(v => [v.receptora_id, { id: v.fazenda_id_atual, nome: v.fazenda_nome_atual }])
    );

    // Agrupar diagnósticos por fazenda + data_te + data_diagnostico + veterinario (sessões virtuais)
    const sessoesMap = new Map<string, {
      fazenda_id: string;
      fazenda_nome: string;
      data_te: string;
      data_diagnostico: string;
      veterinario_responsavel?: string;
      count: number;
    }>();

    diagnosticos.forEach(d => {
      const fazendaInfo = fazendaMap.get(d.receptora_id);
      if (!fazendaInfo) return;

      // Aplicar filtros de fazenda
      if (clienteIdFilter && fazendaIds.length > 0 && !fazendaIds.includes(fazendaInfo.id)) return;
      if (filtroFazenda !== 'all' && fazendaInfo.id !== filtroFazenda) return;

      const key = `${fazendaInfo.id}|${d.data_te}|${d.data_diagnostico}|${d.veterinario_responsavel || ''}`;
      const existing = sessoesMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        sessoesMap.set(key, {
          fazenda_id: fazendaInfo.id,
          fazenda_nome: fazendaInfo.nome,
          data_te: d.data_te,
          data_diagnostico: d.data_diagnostico,
          veterinario_responsavel: d.veterinario_responsavel || undefined,
          count: 1,
        });
      }
    });

    // Converter para array e ordenar por data de diagnóstico
    const sessoesArray = Array.from(sessoesMap.entries()).map(([key, value]) => ({
      id: key,
      fazenda_id: value.fazenda_id,
      fazenda_nome: value.fazenda_nome,
      data: value.data_diagnostico,
      veterinario_responsavel: value.veterinario_responsavel,
      total_registros: value.count,
    }));

    sessoesArray.sort((a, b) => b.data.localeCompare(a.data));
    setSessoesSexagem(sessoesArray);
  };

  // Dados filtrados por busca
  const dadosFiltrados = useMemo(() => {
    let dados: any[] = [];
    switch (tipoServico) {
      case 'protocolos':
        dados = protocolos;
        break;
      case 'aspiracoes':
        dados = aspiracoes;
        break;
      case 'te':
        dados = sessoesTe;
        break;
      case 'dg':
        dados = sessoesDg;
        break;
      case 'sexagem':
        dados = sessoesSexagem;
        break;
    }

    if (filtroBusca.trim()) {
      const busca = filtroBusca.toLowerCase();
      dados = dados.filter(d =>
        d.fazenda_nome?.toLowerCase().includes(busca) ||
        d.veterinario_responsavel?.toLowerCase().includes(busca)
      );
    }

    return dados;
  }, [tipoServico, protocolos, aspiracoes, sessoesTe, sessoesDg, sessoesSexagem, filtroBusca]);

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
    setFiltroDataTipo('data_inicio');
    setPaginaAtual(1);
  };

  const handleTabChange = (value: string) => {
    setTipoServico(value as TipoServico);
    setSearchParams({ tipo: value });
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
    const statusConfig: Record<string, { label: string; className: string }> = {
      'FINALIZADO': { label: 'Finalizado', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
      'FECHADO': { label: 'Finalizado', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
      'ABERTO': { label: 'Em Andamento', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
      'EM_ANDAMENTO': { label: 'Em Andamento', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
      'AGUARDANDO_PASSO2': { label: 'Aguardando', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30' },
      'PASSO1_FECHADO': { label: 'Aguard. 2º Passo', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30' },
      'EM_TE': { label: 'Em TE', className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30' },
      'SINCRONIZADO': { label: 'Sincronizado', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const handleVerDetalhe = (tipo: TipoServico, row: SessaoRow | ProtocoloRow | AspiracaoRow) => {
    switch (tipo) {
      case 'protocolos':
        navigate(`/protocolos/${row.id}/relatorio`);
        break;
      case 'aspiracoes':
        navigate(`/aspiracoes/${row.id}`);
        break;
      case 'te': {
        // ID formato: fazenda_id|data_te|vet
        const sessaoRow = row as SessaoRow;
        const params = new URLSearchParams({
          fazenda: sessaoRow.fazenda_nome,
          data_te: sessaoRow.data,
        });
        if (sessaoRow.veterinario_responsavel) {
          params.set('vet', sessaoRow.veterinario_responsavel);
        }
        navigate(`/transferencia/sessao?${params.toString()}`);
        break;
      }
      case 'dg': {
        // ID formato: fazenda_id|data_te|data_diagnostico|vet
        const sessaoRow = row as SessaoRow;
        const parts = sessaoRow.id.split('|');
        const dataTe = parts[1] || '';
        const params = new URLSearchParams({
          fazenda: sessaoRow.fazenda_nome,
          data_te: dataTe,
          data_dg: sessaoRow.data,
        });
        if (sessaoRow.veterinario_responsavel) {
          params.set('vet', sessaoRow.veterinario_responsavel);
        }
        navigate(`/dg/sessao?${params.toString()}`);
        break;
      }
      case 'sexagem': {
        // ID formato: fazenda_id|data_te|data_diagnostico|vet
        const sessaoRow = row as SessaoRow;
        const parts = sessaoRow.id.split('|');
        const dataTe = parts[1] || '';
        const params = new URLSearchParams({
          fazenda: sessaoRow.fazenda_nome,
          data_te: dataTe,
          data_sexagem: sessaoRow.data,
        });
        if (sessaoRow.veterinario_responsavel) {
          params.set('vet', sessaoRow.veterinario_responsavel);
        }
        navigate(`/sexagem/sessao?${params.toString()}`);
        break;
      }
    }
  };

  const handleExportPdf = () => {
    if (dadosFiltrados.length === 0) return;

    // Mapear tipo de serviço para config do PDF
    const configMap: Record<TipoServico, keyof typeof pdfConfigs> = {
      protocolos: 'protocolos',
      aspiracoes: 'aspiracoes',
      te: 'te',
      dg: 'dg',
      sexagem: 'sexagem',
    };

    // Preparar metadata com filtros aplicados
    const fazendaNome = filtroFazenda !== 'all'
      ? fazendas.find(f => f.id === filtroFazenda)?.nome
      : undefined;

    const periodo = filtroDataInicio || filtroDataFim
      ? `${filtroDataInicio ? formatDate(filtroDataInicio) : '...'} a ${filtroDataFim ? formatDate(filtroDataFim) : '...'}`
      : undefined;

    exportRelatorio(configMap[tipoServico], dadosFiltrados, {
      fazenda: fazendaNome,
      periodo,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Serviços de Campo"
        description="Histórico de protocolos, aspirações, transferências e diagnósticos"
      />

      {/* Tabs de tipo de serviço */}
      <Tabs value={tipoServico} onValueChange={handleTabChange}>
        {/* Tabs Premium */}
        <div className="rounded-xl border border-border bg-card p-1.5">
          <div className="flex gap-1">
            {[
              { value: 'protocolos', label: 'Protocolos', icon: Syringe },
              { value: 'aspiracoes', label: 'Aspirações', icon: TestTube },
              { value: 'te', label: 'Transferência', icon: ArrowRightLeft },
              { value: 'dg', label: 'Diagnóstico', icon: ThumbsUp },
              { value: 'sexagem', label: 'Sexagem', icon: GenderIcon },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
                className={`
                  relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  text-sm font-medium transition-all duration-200
                  ${tipoServico === value
                    ? 'bg-muted/80 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }
                `}
              >
                {/* Indicador inferior para tab ativa */}
                {tipoServico === value && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                )}

                {/* Ícone com container */}
                <div className={`
                  flex items-center justify-center w-7 h-7 rounded-md transition-colors
                  ${tipoServico === value
                    ? 'bg-primary/15'
                    : 'bg-muted/50'
                  }
                `}>
                  <Icon className={`w-4 h-4 ${tipoServico === value ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>

                {/* Label - esconde em mobile */}
                <span className="hidden sm:inline">{label}</span>

                {/* Badge de contagem */}
                {tipoServico === value && dadosFiltrados.length > 0 && (
                  <span className="hidden md:inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold bg-primary/15 text-primary rounded-full">
                    {dadosFiltrados.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-stretch">
            {/* Grupo: Busca */}
            <div className="flex items-center px-4 py-3 border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
              <div className="relative min-w-[200px] max-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                <Input
                  placeholder="Buscar fazenda, veterinário..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="pl-9 h-9 bg-background/80 border-primary/20 focus:border-primary/40"
                />
              </div>
            </div>

            {/* Grupo: Filtros principais */}
            <div className="flex items-center gap-3 px-4 py-3 border-r border-border">
              {/* Indicador visual de seção */}
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-primary/40" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtros</span>
              </div>

              {/* Fazenda */}
              <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
                <SelectTrigger className="w-[170px] h-9 bg-background">
                  <SelectValue placeholder="Fazenda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas fazendas</SelectItem>
                  {fazendas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status (apenas para protocolos e aspirações) */}
              {(tipoServico === 'protocolos' || tipoServico === 'aspiracoes') && (
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[140px] h-9 bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                    <SelectItem value="ABERTO">Em Andamento</SelectItem>
                    {tipoServico === 'protocolos' && (
                      <SelectItem value="AGUARDANDO_PASSO2">Aguardando</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Grupo: Período */}
            <div className="flex items-center gap-3 px-4 py-3 border-r border-border bg-muted/30">
              {/* Indicador visual de seção */}
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-primary/40" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Período</span>
              </div>

              {/* Seletor de tipo de data (apenas para protocolos) */}
              {tipoServico === 'protocolos' && (
                <Select value={filtroDataTipo} onValueChange={(v) => setFiltroDataTipo(v as 'data_inicio' | 'passo2_data')}>
                  <SelectTrigger className="h-8 w-[90px] text-xs bg-background/60 border-dashed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data_inicio">1º Passo</SelectItem>
                    <SelectItem value="passo2_data">2º Passo</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <DatePickerBR
                  value={filtroDataInicio}
                  onChange={setFiltroDataInicio}
                  placeholder="Início"
                  className="h-9 w-[120px] bg-background"
                />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-px bg-primary/40" />
                  <div className="w-1 h-1 rounded-full bg-primary/60" />
                  <div className="w-2 h-px bg-primary/40" />
                </div>
                <DatePickerBR
                  value={filtroDataFim}
                  onChange={setFiltroDataFim}
                  placeholder="Fim"
                  className="h-9 w-[120px] bg-background"
                />
              </div>
            </div>

            {/* Grupo: Ações */}
            <div className="flex items-center gap-2 px-4 py-3 ml-auto bg-gradient-to-b from-muted/50 to-transparent">
              {(filtroBusca || filtroFazenda !== 'all' || filtroStatus !== 'all' || filtroDataInicio || filtroDataFim || filtroDataTipo !== 'data_inicio') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLimparFiltros}
                  className="h-9 border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => loadData()}
                className="h-9 bg-primary hover:bg-primary-dark shadow-sm shadow-primary/25"
              >
                <Search className="w-4 h-4 mr-1" />
                Buscar
              </Button>
              {dadosFiltrados.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  className="h-9 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo das tabs */}
        <TabsContent value={tipoServico} className="mt-4">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : dadosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header da tabela com gradiente */}
              <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
                <div className={`grid gap-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ${
                  tipoServico === 'te' || tipoServico === 'dg' || tipoServico === 'sexagem'
                    ? 'grid-cols-[2fr_1fr_1.5fr_1fr_0.6fr]'
                    : 'grid-cols-[2fr_1fr_1.5fr_0.8fr_1fr_0.6fr]'
                }`}>
                  <div className="px-4 py-3 flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-primary/40" />
                    Fazenda
                  </div>
                  <div className="px-3 py-3 text-center">Data</div>
                  <div className="px-3 py-3">Veterinário</div>
                  <div className="px-3 py-3 text-center">
                    {tipoServico === 'protocolos' ? 'Recept.' : tipoServico === 'aspiracoes' ? 'Doadoras' : 'Registros'}
                  </div>
                  {(tipoServico === 'protocolos' || tipoServico === 'aspiracoes') && (
                    <div className="px-3 py-3 text-center">Status</div>
                  )}
                  <div className="px-2 py-3"></div>
                </div>
              </div>

              {/* Linhas da tabela */}
              <div className="divide-y divide-border/50">
                {dadosPaginados.map((row: ProtocoloRow | AspiracaoRow | SessaoRow, index: number) => (
                  <div
                    key={row.id}
                    onClick={() => handleVerDetalhe(tipoServico, row)}
                    className={`
                      group grid gap-0 items-center cursor-pointer transition-all duration-150
                      hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                      ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                      ${tipoServico === 'te' || tipoServico === 'dg' || tipoServico === 'sexagem'
                        ? 'grid-cols-[2fr_1fr_1.5fr_1fr_0.6fr]'
                        : 'grid-cols-[2fr_1fr_1.5fr_0.8fr_1fr_0.6fr]'
                      }
                    `}
                  >
                    {/* Coluna Fazenda com indicador */}
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                      <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {row.fazenda_nome}
                      </span>
                    </div>

                    {/* Coluna Data */}
                    <div className="px-3 py-3.5 text-sm text-center text-muted-foreground">
                      {formatDate(
                        tipoServico === 'protocolos' ? (row as ProtocoloRow).data_inicio :
                        tipoServico === 'aspiracoes' ? (row as AspiracaoRow).data_aspiracao :
                        (row as SessaoRow).data
                      )}
                    </div>

                    {/* Coluna Veterinário */}
                    <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                      {row.veterinario_responsavel || '-'}
                    </div>

                    {/* Coluna Contagem */}
                    <div className="px-3 py-3.5 flex justify-center">
                      <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-md group-hover:bg-primary/20 transition-colors">
                        {tipoServico === 'protocolos' ? (row as ProtocoloRow).total_receptoras :
                         tipoServico === 'aspiracoes' ? (row as AspiracaoRow).total_doadoras :
                         (row as SessaoRow).total_registros}
                      </span>
                    </div>

                    {/* Coluna Status (apenas protocolos e aspirações) */}
                    {(tipoServico === 'protocolos' || tipoServico === 'aspiracoes') && (
                      <div className="px-3 py-3.5 flex justify-center">
                        {getStatusBadge((row as ProtocoloRow | AspiracaoRow).status)}
                      </div>
                    )}

                    {/* Coluna Ação */}
                    <div className="px-2 py-3.5 flex justify-center">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
                        <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
