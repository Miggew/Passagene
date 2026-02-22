/**
 * Página "Relatórios" para clientes
 * Histórico de atividades com filtros por fazenda, tipo e período (mês)
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import LoadingScreen from '@/components/shared/LoadingScreen';
import { useClienteHubData } from '@/hooks/cliente';
import {
  Stethoscope,
  ScanSearch,
  ChevronDown,
  ChevronRight,
  Syringe,
  TestTube,
  Calendar,
  Check,
  Dna,
  ClipboardList,
  X,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import StatusBadge from '@/components/shared/StatusBadge';
import CountBadge from '@/components/shared/CountBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============ TIPOS ============

type TipoRelatorio = 'todos' | 'dg' | 'sexagem' | 'te' | 'aspiracao' | 'protocolo';

interface AtividadeDetalhe {
  id: string;
  identificacao: string;
  resultado?: string;
  cruzamento?: string;
  classificacao?: string;
  status?: string;
  motivo_inapta?: string;
}

interface AtividadeRecente {
  tipo: 'te' | 'dg' | 'sexagem' | 'aspiracao' | 'protocolo';
  data: Date;
  total: number;
  positivos?: number;
  negativos?: number;
  oocitos?: number;
  veterinario?: string;
  fazenda_id: string;
  fazenda_nome: string;
  detalhes: AtividadeDetalhe[];
  protocolo_id?: string;
  data_passo1?: Date;
  data_passo2?: Date;
  veterinario_passo1?: string;
  veterinario_passo2?: string;
  sincronizadas?: number;
  servidas?: number;
  descartadas?: number;
  te_realizadas?: number;
  te_descartadas?: number;
}

// Gerar lista de meses (últimos 12 + "Todo o período")
function gerarOpcoesMeses(): { value: string; label: string }[] {
  const opcoes: { value: string; label: string }[] = [];
  const hoje = new Date();

  for (let i = 0; i < 12; i++) {
    const data = subMonths(hoje, i);
    const value = format(data, 'yyyy-MM');
    const label = format(data, "MMMM/yyyy", { locale: ptBR });
    // Capitalizar primeira letra
    opcoes.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  opcoes.push({ value: 'todo', label: 'Todo o período' });
  return opcoes;
}

// ============ COMPONENTE PRINCIPAL ============

export default function ClienteRelatorios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { clienteId } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Filtros
  const tipoInicial = (searchParams.get('tipo') as TipoRelatorio) || 'todos';
  const expandirUltimo = searchParams.get('expandir') === 'ultimo';
  const idsParam = searchParams.get('ids');
  const idsFixos = idsParam ? idsParam.split(',').filter(Boolean) : [];
  const [mostrarApenasUltimo, setMostrarApenasUltimo] = useState(expandirUltimo);
  const [tipoFiltro, setTipoFiltro] = useState<TipoRelatorio>(tipoInicial);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>(
    expandirUltimo ? 'todo' : format(new Date(), 'yyyy-MM')
  );
  const [fazendaFiltro, setFazendaFiltro] = useState<string>('todas');

  // Dados
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);

  // Opções de meses
  const opcoesMeses = useMemo(() => gerarOpcoesMeses(), []);

  // Hook de cache compartilhado
  const { data: hubData, isLoading: hubLoading } = useClienteHubData(clienteId);

  // Lista de fazendas para o select
  const fazendaOptions = useMemo(() => {
    if (!hubData) return [];
    return hubData.fazendaIds.map(id => ({
      value: id,
      label: hubData.fazendaNomeMap.get(id) || 'Fazenda',
    }));
  }, [hubData]);

  // Carregar atividades quando hubData estiver pronto
  useEffect(() => {
    if (hubData && !hubLoading) {
      loadAtividades();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubData, hubLoading]);

  // Auto-expandir items quando vindo do dashboard
  useEffect(() => {
    if (mostrarApenasUltimo && !loading && atividadesFiltradas.length > 0) {
      // Expandir todos os cards (são poucos - 1 por fazenda)
      setExpandedSection('ativ-0');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mostrarApenasUltimo]);

  // Filtrar atividades
  const atividadesFiltradas = useMemo(() => {
    let filtered = atividades.filter(a => {
      // Filtro de tipo
      if (tipoFiltro !== 'todos' && a.tipo !== tipoFiltro) return false;

      // Filtro de fazenda
      if (fazendaFiltro !== 'todas' && a.fazenda_id !== fazendaFiltro) return false;

      // Filtro de período (mês)
      if (periodoFiltro !== 'todo') {
        const mesInicio = startOfMonth(parseISO(periodoFiltro + '-01'));
        const mesFim = endOfMonth(mesInicio);
        if (!isWithinInterval(a.data, { start: mesInicio, end: mesFim })) return false;
      }

      return true;
    });

    // Modo "último": filtrar para mostrar exatamente os mesmos dados do card do Home
    if (mostrarApenasUltimo && tipoFiltro !== 'todos') {
      // Se há IDs específicos (vindos do Home), filtrar por eles
      if (idsFixos.length > 0) {
        filtered = filtered.filter(a => a.protocolo_id && idsFixos.includes(a.protocolo_id));
      } else {
        // Fallback: manter apenas a sessão mais recente por fazenda
        const fazendaVista = new Set<string>();
        filtered = filtered.filter(a => {
          if (fazendaVista.has(a.fazenda_id)) return false;
          fazendaVista.add(a.fazenda_id);
          return true;
        });
      }
    }

    return filtered;
  }, [atividades, tipoFiltro, fazendaFiltro, periodoFiltro, mostrarApenasUltimo, idsFixos]);

  // ============ CARREGAMENTO ============

  const loadAtividades = async () => {
    if (!hubData || hubData.fazendaIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { fazendaIds, fazendaNomeMap, receptoraIds, receptoraFazendaMap, receptoras } = hubData;

      const atividadesData: AtividadeRecente[] = [];
      const receptoraIdentMap = new Map(receptoras.map(r => [r.id, r.identificacao || 'Sem ID']));

      // Buscar todas as atividades em paralelo (últimos 12 meses)
      const dataInicio12m = format(subMonths(new Date(), 12), 'yyyy-MM-dd');

      const [
        ultimasTEsResult,
        ultimosDGsResult,
        ultimasSexagensResult,
        ultimasAspiracoesResult,
        ultimosProtocolosResult,
      ] = await Promise.all([
        receptoraIds.length > 0
          ? supabase
              .from('transferencias_embrioes')
              .select('id, receptora_id, data_te, veterinario_responsavel, embriao_id')
              .in('receptora_id', receptoraIds)
              .eq('status_te', 'REALIZADA')
              .gte('data_te', dataInicio12m)
              .order('data_te', { ascending: false })
          : { data: [] },
        receptoraIds.length > 0
          ? supabase
              .from('diagnosticos_gestacao')
              .select('receptora_id, data_diagnostico, resultado, veterinario_responsavel')
              .in('receptora_id', receptoraIds)
              .eq('tipo_diagnostico', 'DG')
              .gte('data_diagnostico', dataInicio12m)
              .order('data_diagnostico', { ascending: false })
          : { data: [] },
        receptoraIds.length > 0
          ? supabase
              .from('diagnosticos_gestacao')
              .select('receptora_id, data_diagnostico, resultado, sexagem, veterinario_responsavel')
              .in('receptora_id', receptoraIds)
              .eq('tipo_diagnostico', 'SEXAGEM')
              .gte('data_diagnostico', dataInicio12m)
              .order('data_diagnostico', { ascending: false })
          : { data: [] },
        supabase
          .from('pacotes_aspiracao')
          .select('id, fazenda_id, data_aspiracao, veterinario_responsavel')
          .in('fazenda_id', fazendaIds)
          .gte('data_aspiracao', dataInicio12m)
          .order('data_aspiracao', { ascending: false }),
        supabase
          .from('protocolos_sincronizacao')
          .select('id, fazenda_id, data_inicio, passo2_data, responsavel_inicio, passo2_tecnico_responsavel, protocolo_receptoras(receptora_id, status, motivo_inapta)')
          .in('fazenda_id', fazendaIds)
          .gte('data_inicio', dataInicio12m)
          .order('data_inicio', { ascending: false }),
      ]);

      // Extrair descartes de TE dos dados de protocolo
      const descartesTE: { receptora_id: string; motivo: string; data: string; fazenda_id: string }[] = [];
      if (ultimosProtocolosResult.data) {
        for (const protocolo of ultimosProtocolosResult.data) {
          const receptorasProtocolo = (protocolo.protocolo_receptoras as { receptora_id: string; status: string; motivo_inapta?: string }[]) || [];
          const dataTE = protocolo.passo2_data || protocolo.data_inicio;
          for (const pr of receptorasProtocolo) {
            if (pr.status === 'INAPTA' && pr.motivo_inapta && pr.motivo_inapta.toLowerCase().includes('te')) {
              descartesTE.push({
                receptora_id: pr.receptora_id,
                motivo: pr.motivo_inapta,
                data: dataTE.split('T')[0],
                fazenda_id: protocolo.fazenda_id,
              });
            }
          }
        }
      }

      // Processar TEs - agrupar por fazenda e data (incluindo descartes)
      const tesPorFazendaData = new Map<string, {
        realizadas: typeof ultimasTEsResult.data;
        descartadas: typeof descartesTE;
        data: string;
        fazendaId: string;
        veterinario?: string;
      }>();

      if (ultimasTEsResult.data && ultimasTEsResult.data.length > 0) {
        ultimasTEsResult.data.forEach(te => {
          const fazendaId = receptoraFazendaMap.get(te.receptora_id);
          if (!fazendaId) return;
          const dataStr = te.data_te.split('T')[0];
          const key = `${fazendaId}::${dataStr}`;
          if (!tesPorFazendaData.has(key)) {
            tesPorFazendaData.set(key, { realizadas: [], descartadas: [], data: dataStr, fazendaId, veterinario: te.veterinario_responsavel || undefined });
          }
          tesPorFazendaData.get(key)!.realizadas.push(te);
        });
      }

      for (const desc of descartesTE) {
        const key = `${desc.fazenda_id}::${desc.data}`;
        if (!tesPorFazendaData.has(key)) {
          tesPorFazendaData.set(key, { realizadas: [], descartadas: [], data: desc.data, fazendaId: desc.fazenda_id });
        }
        tesPorFazendaData.get(key)!.descartadas.push(desc);
      }

      // Criar atividades de TE
      if (tesPorFazendaData.size > 0) {
        const todosEmbriaoIds = ultimasTEsResult.data?.map(te => te.embriao_id).filter(Boolean) as string[] || [];
        const cruzamentoMap = await loadCruzamentosEmbrioes(todosEmbriaoIds);

        for (const [, grupo] of tesPorFazendaData) {
          const totalRealizadas = grupo.realizadas.length;
          const totalDescartadas = grupo.descartadas.length;
          const total = totalRealizadas + totalDescartadas;
          if (total === 0) continue;

          const detalhes: AtividadeDetalhe[] = [
            ...grupo.realizadas.map(te => ({
              id: te.receptora_id,
              identificacao: receptoraIdentMap.get(te.receptora_id) || 'Sem ID',
              cruzamento: te.embriao_id ? cruzamentoMap.get(te.embriao_id) : undefined,
              status: 'REALIZADA',
            })),
            ...grupo.descartadas.map(desc => ({
              id: desc.receptora_id,
              identificacao: receptoraIdentMap.get(desc.receptora_id) || 'Sem ID',
              status: 'DESCARTADA',
              motivo_inapta: desc.motivo,
            })),
          ];

          atividadesData.push({
            tipo: 'te',
            data: new Date(grupo.data),
            total,
            veterinario: grupo.veterinario,
            fazenda_id: grupo.fazendaId,
            fazenda_nome: fazendaNomeMap.get(grupo.fazendaId) || 'Fazenda',
            detalhes,
            te_realizadas: totalRealizadas,
            te_descartadas: totalDescartadas,
          });
        }
      }

      // Processar DGs - agrupar por fazenda e data
      if (ultimosDGsResult.data && ultimosDGsResult.data.length > 0) {
        const dgsPorFazendaData = new Map<string, typeof ultimosDGsResult.data>();

        ultimosDGsResult.data.forEach(dg => {
          const fazendaId = receptoraFazendaMap.get(dg.receptora_id);
          if (!fazendaId) return;
          const key = `${fazendaId}::${dg.data_diagnostico}`;
          if (!dgsPorFazendaData.has(key)) {
            dgsPorFazendaData.set(key, []);
          }
          dgsPorFazendaData.get(key)!.push(dg);
        });

        for (const [key, dgs] of dgsPorFazendaData) {
          const fazendaId = key.split('::')[0];
          const positivos = dgs.filter(d => d.resultado === 'PRENHE' || d.resultado?.startsWith('PRENHE_')).length;
          const perdas = dgs.filter(d => d.resultado === 'VAZIA').length;

          atividadesData.push({
            tipo: 'dg',
            data: new Date(dgs[0].data_diagnostico),
            total: dgs.length,
            positivos,
            negativos: perdas,
            veterinario: dgs[0].veterinario_responsavel || undefined,
            fazenda_id: fazendaId,
            fazenda_nome: fazendaNomeMap.get(fazendaId) || 'Fazenda',
            detalhes: dgs.map(dg => ({
              id: dg.receptora_id,
              identificacao: receptoraIdentMap.get(dg.receptora_id) || 'Sem ID',
              resultado: dg.resultado,
            })),
          });
        }
      }

      // Processar Sexagens - agrupar por fazenda e data
      if (ultimasSexagensResult.data && ultimasSexagensResult.data.length > 0) {
        const sexagensPorFazendaData = new Map<string, typeof ultimasSexagensResult.data>();

        ultimasSexagensResult.data.forEach(s => {
          const fazendaId = receptoraFazendaMap.get(s.receptora_id);
          if (!fazendaId) return;
          const key = `${fazendaId}::${s.data_diagnostico}`;
          if (!sexagensPorFazendaData.has(key)) {
            sexagensPorFazendaData.set(key, []);
          }
          sexagensPorFazendaData.get(key)!.push(s);
        });

        for (const [key, sexagens] of sexagensPorFazendaData) {
          const fazendaId = key.split('::')[0];
          const femeas = sexagens.filter(s => s.sexagem === 'FEMEA').length;
          const machos = sexagens.filter(s => s.sexagem === 'MACHO').length;
          const perdas = sexagens.filter(s => s.resultado === 'VAZIA' || s.sexagem === 'VAZIA').length;

          atividadesData.push({
            tipo: 'sexagem',
            data: new Date(sexagens[0].data_diagnostico),
            total: sexagens.length,
            positivos: femeas,
            negativos: machos,
            oocitos: perdas,
            veterinario: sexagens[0].veterinario_responsavel || undefined,
            fazenda_id: fazendaId,
            fazenda_nome: fazendaNomeMap.get(fazendaId) || 'Fazenda',
            detalhes: sexagens.map(s => ({
              id: s.receptora_id,
              identificacao: receptoraIdentMap.get(s.receptora_id) || 'Sem ID',
              resultado: s.sexagem || s.resultado,
            })),
          });
        }
      }

      // Processar Aspirações
      if (ultimasAspiracoesResult.data && ultimasAspiracoesResult.data.length > 0) {
        const aspIds = ultimasAspiracoesResult.data.map(a => a.id);
        const { data: aspDoadoras } = await supabase
          .from('aspiracoes_doadoras')
          .select('pacote_aspiracao_id, viaveis, doadora_id, doadoras(nome, registro)')
          .in('pacote_aspiracao_id', aspIds);

        for (const asp of ultimasAspiracoesResult.data) {
          const doadorasAsp = aspDoadoras?.filter(a => a.pacote_aspiracao_id === asp.id) || [];
          if (doadorasAsp.length > 0) {
            const totalOocitos = doadorasAsp.reduce((sum, a) => sum + (a.viaveis || 0), 0);

            atividadesData.push({
              tipo: 'aspiracao',
              data: new Date(asp.data_aspiracao),
              total: doadorasAsp.length,
              oocitos: totalOocitos,
              veterinario: asp.veterinario_responsavel || undefined,
              fazenda_id: asp.fazenda_id,
              fazenda_nome: fazendaNomeMap.get(asp.fazenda_id) || 'Fazenda',
              detalhes: doadorasAsp.map(a => ({
                id: a.doadora_id,
                identificacao: (a.doadoras as { nome?: string; registro?: string } | null)?.nome || (a.doadoras as { nome?: string; registro?: string } | null)?.registro || 'Sem ID',
                resultado: `${a.viaveis || 0} oócitos`,
              })),
            });
          }
        }
      }

      // Processar Protocolos
      if (ultimosProtocolosResult.data && ultimosProtocolosResult.data.length > 0) {
        for (const p of ultimosProtocolosResult.data) {
          const receptorasProtocolo = (p.protocolo_receptoras as { receptora_id: string; status: string; motivo_inapta?: string }[]) || [];
          if (receptorasProtocolo.length > 0) {
            const dataReferencia = p.passo2_data ? new Date(p.passo2_data) : new Date(p.data_inicio);
            const sincronizadas = receptorasProtocolo.length;
            const servidas = receptorasProtocolo.filter(pr => pr.status === 'UTILIZADA').length;
            const descartadasCount = receptorasProtocolo.filter(pr => pr.status === 'INAPTA').length;

            atividadesData.push({
              tipo: 'protocolo',
              data: dataReferencia,
              total: receptorasProtocolo.length,
              fazenda_id: p.fazenda_id,
              fazenda_nome: fazendaNomeMap.get(p.fazenda_id) || 'Fazenda',
              detalhes: receptorasProtocolo.slice(0, 15).map(pr => ({
                id: pr.receptora_id,
                identificacao: receptoraIdentMap.get(pr.receptora_id) || 'Sem ID',
                status: pr.status,
                motivo_inapta: pr.motivo_inapta,
              })),
              protocolo_id: p.id,
              data_passo1: new Date(p.data_inicio),
              data_passo2: p.passo2_data ? new Date(p.passo2_data) : undefined,
              veterinario_passo1: (p as { responsavel_inicio?: string }).responsavel_inicio || undefined,
              veterinario_passo2: (p as { passo2_tecnico_responsavel?: string }).passo2_tecnico_responsavel || undefined,
              sincronizadas,
              servidas,
              descartadas: descartadasCount,
            });
          }
        }
      }

      atividadesData.sort((a, b) => b.data.getTime() - a.data.getTime());
      setAtividades(atividadesData);

    } catch (error) {
      toast({
        title: 'Erro ao carregar relatórios',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar cruzamentos (doadora × touro)
  async function loadCruzamentosEmbrioes(embriaoIds: string[]): Promise<Map<string, string>> {
    if (embriaoIds.length === 0) return new Map();

    const { data: embrioes } = await supabase
      .from('embrioes')
      .select('id, lote_fiv_acasalamento_id')
      .in('id', embriaoIds);

    if (!embrioes || embrioes.length === 0) return new Map();

    const acasalamentoIds = [...new Set(embrioes.map(e => e.lote_fiv_acasalamento_id).filter(Boolean))];
    if (acasalamentoIds.length === 0) return new Map();

    const { data: acasalamentos } = await supabase
      .from('lote_fiv_acasalamentos')
      .select('id, aspiracao_doadora_id, dose_semen_id')
      .in('id', acasalamentoIds);

    if (!acasalamentos || acasalamentos.length === 0) return new Map();

    const aspiracaoIds = acasalamentos.map(a => a.aspiracao_doadora_id).filter(Boolean);
    const doseIds = acasalamentos.map(a => a.dose_semen_id).filter(Boolean);

    const [aspiracoesResult, dosesResult] = await Promise.all([
      aspiracaoIds.length > 0
        ? supabase.from('aspiracoes_doadoras').select('id, doadora_id').in('id', aspiracaoIds)
        : { data: [] },
      doseIds.length > 0
        ? supabase.from('doses_semen').select('id, touro_id').in('id', doseIds)
        : { data: [] },
    ]);

    const aspiracaoDoadoraMap = new Map<string, string>();
    aspiracoesResult.data?.forEach(a => aspiracaoDoadoraMap.set(a.id, a.doadora_id));

    const doseTouroMap = new Map<string, string>();
    dosesResult.data?.forEach(d => doseTouroMap.set(d.id, d.touro_id));

    const doadoraIds = [...new Set(Array.from(aspiracaoDoadoraMap.values()).filter(Boolean))];
    const touroIds = [...new Set(Array.from(doseTouroMap.values()).filter(Boolean))];

    const [doadorasResult, tourosResult] = await Promise.all([
      doadoraIds.length > 0
        ? supabase.from('doadoras').select('id, nome, registro').in('id', doadoraIds)
        : { data: [] },
      touroIds.length > 0
        ? supabase.from('touros').select('id, nome, registro').in('id', touroIds)
        : { data: [] },
    ]);

    const doadoraNomeMap = new Map<string, string>();
    doadorasResult.data?.forEach(d => doadoraNomeMap.set(d.id, d.nome || d.registro || '?'));

    const touroNomeMap = new Map<string, string>();
    tourosResult.data?.forEach(t => touroNomeMap.set(t.id, t.nome || t.registro || '?'));

    const acasalamentoCruzMap = new Map<string, string>();
    acasalamentos.forEach(ac => {
      const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
      const touroId = doseTouroMap.get(ac.dose_semen_id);
      const doadora = doadoraId ? doadoraNomeMap.get(doadoraId) || '?' : '?';
      const touro = touroId ? touroNomeMap.get(touroId) || '?' : '?';
      acasalamentoCruzMap.set(ac.id, `${doadora} × ${touro}`);
    });

    const embriaoCruzMap = new Map<string, string>();
    embrioes.forEach(e => {
      if (e.lote_fiv_acasalamento_id && acasalamentoCruzMap.has(e.lote_fiv_acasalamento_id)) {
        embriaoCruzMap.set(e.id, acasalamentoCruzMap.get(e.lote_fiv_acasalamento_id)!);
      }
    });

    return embriaoCruzMap;
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // ============ RENDER ============

  if (loading || hubLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title="Relatórios" />

      {/* ========== BANNER MODO ÚLTIMO ========== */}
      {mostrarApenasUltimo && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Último serviço por fazenda
          </span>
          <button
            onClick={() => {
              setMostrarApenasUltimo(false);
              setPeriodoFiltro(format(new Date(), 'yyyy-MM'));
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver todo o histórico →
          </button>
        </div>
      )}

      {/* ========== FILTROS (3 Selects) ========== */}
      <div className={cn(
        "rounded-xl border border-border glass-panel p-3 space-y-3",
        mostrarApenasUltimo && "hidden"
      )}>

        {/* Fazenda */}
        {fazendaOptions.length > 1 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0 w-20">
              <MapPin className="w-4 h-4 text-primary/60" />
              <span className="text-xs font-semibold text-muted-foreground">Fazenda</span>
            </div>
            <Select value={fazendaFiltro} onValueChange={setFazendaFiltro}>
              <SelectTrigger className="h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as fazendas</SelectItem>
                {fazendaOptions.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tipo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0 w-20">
            <ClipboardList className="w-4 h-4 text-primary/60" />
            <span className="text-xs font-semibold text-muted-foreground">Tipo</span>
          </div>
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoRelatorio)}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="dg">DG - Diagnóstico</SelectItem>
              <SelectItem value="sexagem">Sexagem</SelectItem>
              <SelectItem value="te">TE - Transferência</SelectItem>
              <SelectItem value="aspiracao">Aspiração</SelectItem>
              <SelectItem value="protocolo">Protocolo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Período */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0 w-20">
            <Calendar className="w-4 h-4 text-primary/60" />
            <span className="text-xs font-semibold text-muted-foreground">Período</span>
          </div>
          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoesMeses.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ========== LISTA DE RELATÓRIOS ========== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-primary/50" />
            <h2 className="text-sm font-semibold text-foreground">
              {atividadesFiltradas.length} {atividadesFiltradas.length === 1 ? 'relatório' : 'relatórios'}
            </h2>
          </div>
        </div>

        {atividadesFiltradas.length === 0 ? (
          <div className="rounded-xl border border-border/60 glass-panel p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum relatório encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {atividadesFiltradas.map((atividade, index) => (
              <RelatorioCard
                key={`${atividade.tipo}-${atividade.fazenda_id}-${index}`}
                atividade={atividade}
                expanded={expandedSection === `ativ-${index}`}
                onToggle={() => toggleSection(`ativ-${index}`)}
                onNavigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ COMPONENTES AUXILIARES ============

interface RelatorioCardProps {
  atividade: AtividadeRecente;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}

function RelatorioCard({ atividade, expanded, onToggle, onNavigate }: RelatorioCardProps) {
  const iconConfig = {
    te: { icon: Syringe, color: 'violet' as const, label: 'Transferência de Embriões' },
    dg: { icon: Stethoscope, color: 'emerald' as const, label: 'Diagnóstico de Gestação' },
    sexagem: { icon: ScanSearch, color: 'pink' as const, label: 'Sexagem' },
    aspiracao: { icon: TestTube, color: 'amber' as const, label: 'Aspiração' },
    protocolo: { icon: ClipboardList, color: 'blue' as const, label: 'Protocolo' },
  };

  const config = iconConfig[atividade.tipo];
  const Icon = config.icon;

  const colorClasses = {
    violet: {
      iconBg: 'bg-gradient-to-br from-violet-500/20 to-violet-500/5 border-violet-500/15',
      iconText: 'text-violet-500',
    },
    emerald: {
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/15',
      iconText: 'text-emerald-500',
    },
    pink: {
      iconBg: 'bg-gradient-to-br from-pink-500/20 to-pink-500/5 border-pink-500/15',
      iconText: 'text-pink-500',
    },
    amber: {
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/15',
      iconText: 'text-amber-500',
    },
    blue: {
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/15',
      iconText: 'text-blue-500',
    },
  };

  const colors = colorClasses[config.color];

  // Resumo por tipo
  const resumo = atividade.tipo === 'dg'
    ? `${atividade.positivos}/${atividade.total} prenhes${atividade.negativos ? ` · ${atividade.negativos} perda${atividade.negativos > 1 ? 's' : ''}` : ''}`
    : atividade.tipo === 'sexagem'
    ? `${atividade.positivos || 0}♀  ${atividade.negativos || 0}♂${atividade.oocitos ? `  · ${atividade.oocitos} perda${atividade.oocitos > 1 ? 's' : ''}` : ''}`
    : atividade.tipo === 'aspiracao'
    ? `${atividade.total} doadoras · ${atividade.oocitos} oócitos`
    : atividade.tipo === 'protocolo'
    ? `${atividade.total} receptoras${atividade.descartadas ? ` · ${atividade.descartadas} descarte${atividade.descartadas > 1 ? 's' : ''}` : ''}`
    : atividade.tipo === 'te'
    ? `${atividade.te_realizadas || 0} servida${(atividade.te_realizadas || 0) !== 1 ? 's' : ''}${atividade.te_descartadas ? ` · ${atividade.te_descartadas} descarte${atividade.te_descartadas > 1 ? 's' : ''}` : ''}`
    : `${atividade.total} receptoras`;

  return (
    <div className={cn(
      'rounded-xl border border-border/60 glass-panel overflow-hidden transition-all duration-200 shadow-sm',
      expanded && 'shadow-md border-primary/30'
    )}>
      {/* Header do card */}
      <div onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0} className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center border shrink-0', colors.iconBg)}>
          <Icon className={cn('w-5 h-5', colors.iconText)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Título + Data */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-base">{config.label}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {format(atividade.data, "dd/MM/yy", { locale: ptBR })}
            </span>
          </div>

          {/* Fazenda */}
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{atividade.fazenda_nome}</span>
          </div>

          {/* Resumo */}
          <p className="text-sm text-foreground/80 mt-1">{resumo}</p>
        </div>

        <ChevronDown className={cn(
          'w-5 h-5 text-muted-foreground/40 transition-transform duration-200 shrink-0',
          expanded && 'rotate-180 text-primary'
        )} />
      </div>

      {/* Protocolo: datas dos passos */}
      {atividade.tipo === 'protocolo' && (
        <div className="flex items-center gap-4 px-3.5 pb-2 -mt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">1º</span>
            <span className="text-xs text-muted-foreground">{format(atividade.data_passo1!, "dd/MM/yy", { locale: ptBR })}</span>
          </div>
          {atividade.data_passo2 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">2º</span>
              <span className="text-xs text-muted-foreground">{format(atividade.data_passo2, "dd/MM/yy", { locale: ptBR })}</span>
            </div>
          ) : (
            <span className="text-xs text-amber-500/70 italic">2º passo pendente</span>
          )}
        </div>
      )}

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-border/40 pt-3 bg-gradient-to-b from-muted/30 to-transparent">

          {/* Veterinário */}
          {atividade.veterinario && (
            <p className="text-xs text-muted-foreground mb-2">
              Veterinário: {atividade.veterinario}
            </p>
          )}
          {atividade.tipo === 'protocolo' && (
            <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
              {atividade.veterinario_passo1 && <p>1º passo: {atividade.veterinario_passo1}</p>}
              {atividade.veterinario_passo2 && <p>2º passo: {atividade.veterinario_passo2}</p>}
            </div>
          )}

          {/* Badges resumo para protocolo */}
          {atividade.tipo === 'protocolo' && (
            <div className="flex flex-wrap gap-2 mb-2">
              {atividade.sincronizadas !== undefined && atividade.sincronizadas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Check className="w-3 h-3" />
                  {atividade.sincronizadas} sincronizadas
                </span>
              )}
              {atividade.servidas !== undefined && atividade.servidas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Syringe className="w-3 h-3" />
                  {atividade.servidas} servidas
                </span>
              )}
              {atividade.descartadas !== undefined && atividade.descartadas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <X className="w-3 h-3" />
                  {atividade.descartadas} descarte{atividade.descartadas > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Badges resumo para TE */}
          {atividade.tipo === 'te' && (atividade.te_realizadas || atividade.te_descartadas) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {atividade.te_realizadas !== undefined && atividade.te_realizadas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Syringe className="w-3 h-3" />
                  {atividade.te_realizadas} servida{atividade.te_realizadas > 1 ? 's' : ''}
                </span>
              )}
              {atividade.te_descartadas !== undefined && atividade.te_descartadas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <X className="w-3 h-3" />
                  {atividade.te_descartadas} descarte{atividade.te_descartadas > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Lista de detalhes */}
          <div className="border-l-2 border-primary/30 pl-3 space-y-0.5 max-h-[320px] overflow-y-auto">
            {atividade.detalhes.map((det) => (
              <div
                key={det.id}
                onClick={() => {
                  if (atividade.tipo === 'aspiracao') {
                    onNavigate(`/doadoras/${det.id}`);
                  } else if (atividade.tipo === 'protocolo' && atividade.protocolo_id) {
                    onNavigate(`/protocolos/${atividade.protocolo_id}`);
                  } else {
                    onNavigate(`/receptoras/${det.id}/historico`);
                  }
                }}
                className="group flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
              >
                {/* Indicador de status para TE */}
                {atividade.tipo === 'te' && det.status && (
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                    det.status === 'REALIZADA' && 'bg-violet-500/15 border-violet-500/20',
                    det.status === 'DESCARTADA' && 'bg-red-500/15 border-red-500/20',
                  )}>
                    {det.status === 'REALIZADA' && <Syringe className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />}
                    {det.status === 'DESCARTADA' && <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                  </div>
                )}
                {/* Indicador de status para protocolo */}
                {atividade.tipo === 'protocolo' && det.status && (
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                    det.status === 'INAPTA' && 'bg-red-500/15 border-red-500/20',
                    det.status === 'UTILIZADA' && 'bg-violet-500/15 border-violet-500/20',
                    det.status === 'APTA' && 'bg-primary/15 border-primary/20',
                    det.status === 'INICIADA' && 'bg-muted border-border',
                  )}>
                    {det.status === 'INAPTA' && <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                    {det.status === 'UTILIZADA' && <Syringe className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />}
                    {det.status === 'APTA' && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                )}

                {/* Nome da receptora/doadora */}
                <span className={cn(
                  "text-sm font-medium flex-1 truncate",
                  (atividade.tipo === 'protocolo' && det.status === 'INAPTA') && 'text-red-600 dark:text-red-400',
                  (atividade.tipo === 'te' && det.status === 'DESCARTADA') && 'text-red-600 dark:text-red-400'
                )}>
                  {det.identificacao}
                </span>

                {/* Motivo do descarte */}
                {((atividade.tipo === 'protocolo' && det.status === 'INAPTA') ||
                  (atividade.tipo === 'te' && det.status === 'DESCARTADA')) && det.motivo_inapta && (
                  <span className="text-xs text-red-500/80 truncate max-w-[120px]">
                    {det.motivo_inapta.replace('Descartada no menu de TE - ', '')}
                  </span>
                )}

                {/* Resultado (DG/Sexagem) */}
                {det.resultado && atividade.tipo !== 'aspiracao' && atividade.tipo !== 'protocolo' && (
                  <StatusBadge status={det.resultado} size="sm" />
                )}

                {/* Oócitos (Aspiração) */}
                {det.resultado && atividade.tipo === 'aspiracao' && (
                  <CountBadge value={det.resultado} variant="warning" size="sm" />
                )}

                {/* Cruzamento (TE) */}
                {det.cruzamento && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Dna className="w-3 h-3 text-primary" />
                    <span className="truncate max-w-[90px]">{det.cruzamento}</span>
                  </span>
                )}

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
