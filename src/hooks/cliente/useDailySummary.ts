/**
 * Hook para resumo diário AI do Gene
 *
 * Fluxo:
 * 1. Checa cache: SELECT FROM cliente_daily_summaries WHERE summary_date = hoje
 * 2. Cache hit → retorna instantâneo (isFromCache = true)
 * 3. Cache miss → coleta dados do cliente → chama Edge Function → retorna (isFromCache = false)
 */

import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { differenceInDays, addDays } from 'date-fns';
import { DG, SEXAGEM, PASSO2, TE as TE_RULES } from '@/lib/fivFlowRules';

// ==================== TIPOS ====================

interface ProximoServicoData {
  tipo: string;
  label: string;
  total: number;
  prontas: number;
  dias_mais_urgente: number;
  urgente: boolean;
}

interface DailySummaryPayload {
  cliente_id: string;
  cliente_nome: string;
  data: string;
  hora: number;
  receptoras: {
    total: number;
    prenhes: number;
    servidas: number;
    protocoladas: number;
    vazias: number;
  };
  proximos_servicos: ProximoServicoData[];
  ultimos_resultados: {
    te?: { sincronizadas: number; servidas: number; taxa: number };
    dg?: { total: number; prenhes: number; taxa: number };
    sexagem?: { total: number; femeas: number; machos: number; perdas: number };
    aspiracao?: { doadoras: number; oocitos: number; media: number };
  };
  estoque: {
    doadoras: number;
    doses_semen: number;
    embrioes_congelados: number;
  };
  fazendas: Array<{ nome: string; receptoras: number }>;
}

interface DailySummaryResult {
  summary: string;
  isFromCache: boolean;
}

// ==================== CONSTANTES ====================

const DG_DIAS_APOS_TE = DG.MIN_DIAS - TE_RULES.DIA_EMBRIAO;
const SEXAGEM_DIAS_APOS_TE = SEXAGEM.MIN_DIAS - TE_RULES.DIA_EMBRIAO;

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ==================== COLETA DE DADOS ====================

async function collectDashboardData(
  clienteId: string,
  clienteNome: string
): Promise<DailySummaryPayload> {
  const hoje = new Date();
  const todayStr = getTodayStr();

  // Fazendas
  const { data: fazendas } = await supabase
    .from('fazendas')
    .select('id, nome')
    .eq('cliente_id', clienteId);

  const fazendaIds = fazendas?.map(f => f.id) || [];
  if (fazendaIds.length === 0) {
    return {
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      data: todayStr,
      hora: hoje.getHours(),
      receptoras: { total: 0, prenhes: 0, servidas: 0, protocoladas: 0, vazias: 0 },
      proximos_servicos: [],
      ultimos_resultados: {},
      estoque: { doadoras: 0, doses_semen: 0, embrioes_congelados: 0 },
      fazendas: [],
    };
  }

  // Receptoras ativas nas fazendas
  const { data: receptorasView } = await supabase
    .from('receptoras')
    .select('id, fazenda_atual_id')
    .in('fazenda_atual_id', fazendaIds);

  const receptoraIds = receptorasView?.map(r => r.id) || [];

  const { data: receptorasData } = receptoraIds.length > 0
    ? await supabase
      .from('receptoras')
      .select('id, status_reprodutivo, data_provavel_parto')
      .in('id', receptoraIds)
    : { data: [] as Array<{ id: string; status_reprodutivo: string | null; data_provavel_parto: string | null }> };

  // Contagem de receptoras
  const totais = { total: 0, prenhes: 0, servidas: 0, protocoladas: 0, vazias: 0 };
  const receptoraFazendaMap = new Map<string, string>();
  receptorasView?.forEach(r => {
    if (r.fazenda_atual_id) receptoraFazendaMap.set(r.id, r.fazenda_atual_id);
  });

  receptorasData?.forEach(r => {
    totais.total++;
    const status = r.status_reprodutivo || '';
    if (status.includes('PRENHE')) totais.prenhes++;
    else if (status === 'SERVIDA') totais.servidas++;
    else if (status === 'SINCRONIZADA' || status === 'EM_SINCRONIZACAO') totais.protocoladas++;
    else totais.vazias++;
  });

  // Fazendas com contagem de receptoras
  const fazendaReceptoraCount = new Map<string, number>();
  receptorasView?.forEach(r => {
    if (r.fazenda_atual_id) {
      fazendaReceptoraCount.set(
        r.fazenda_atual_id,
        (fazendaReceptoraCount.get(r.fazenda_atual_id) || 0) + 1
      );
    }
  });
  const fazendaList = (fazendas || []).map(f => ({
    nome: f.nome,
    receptoras: fazendaReceptoraCount.get(f.id) || 0,
  }));

  // Paralelo: próximos serviços + últimos resultados + estoque
  const [proximosServicos, ultimosResultados, estoque] = await Promise.all([
    collectProximosServicos(receptorasData || [], hoje),
    collectUltimosResultados(receptoraIds, fazendaIds, receptoraFazendaMap),
    collectEstoque(clienteId, fazendaIds),
  ]);

  return {
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    data: todayStr,
    hora: hoje.getHours(),
    receptoras: totais,
    proximos_servicos: proximosServicos,
    ultimos_resultados: ultimosResultados,
    estoque,
    fazendas: fazendaList,
  };
}

// ==================== PRÓXIMOS SERVIÇOS ====================

async function collectProximosServicos(
  receptorasData: Array<{ id: string; status_reprodutivo: string | null; data_provavel_parto: string | null }>,
  hoje: Date
): Promise<ProximoServicoData[]> {
  const servicos: ProximoServicoData[] = [];

  const emSinc = receptorasData.filter(r => r.status_reprodutivo === 'EM_SINCRONIZACAO');
  const sincronizadas = receptorasData.filter(r => r.status_reprodutivo === 'SINCRONIZADA');
  const servidas = receptorasData.filter(r => r.status_reprodutivo === 'SERVIDA');
  const prenhesBase = receptorasData.filter(r =>
    r.status_reprodutivo === 'PRENHE' || r.status_reprodutivo === 'PRENHE_RETOQUE'
  );
  const prenhesComParto = receptorasData.filter(r =>
    r.status_reprodutivo?.includes('PRENHE') && r.data_provavel_parto
  );

  // TE dates para SERVIDA/PRENHE
  const needTE = [...servidas.map(r => r.id), ...prenhesBase.map(r => r.id)];
  const teDateMap = new Map<string, string>();
  if (needTE.length > 0) {
    const { data: tes } = await supabase
      .from('transferencias_embrioes')
      .select('receptora_id, data_te')
      .in('receptora_id', needTE)
      .order('data_te', { ascending: false });
    tes?.forEach(te => {
      if (!teDateMap.has(te.receptora_id)) teDateMap.set(te.receptora_id, te.data_te);
    });
  }

  // Protocol dates para EM_SINCRONIZACAO/SINCRONIZADA
  const needProt = [...emSinc.map(r => r.id), ...sincronizadas.map(r => r.id)];
  const protDateMap = new Map<string, { data_inicio: string; passo2_data?: string }>();
  if (needProt.length > 0) {
    const { data: links } = await supabase
      .from('protocolo_receptoras')
      .select('receptora_id, protocolo_id')
      .in('receptora_id', needProt);

    if (links && links.length > 0) {
      const protIds = [...new Set(links.map(l => l.protocolo_id))];
      const { data: prots } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, data_inicio, passo2_data')
        .in('id', protIds);

      if (prots) {
        const pm = new Map(prots.map(p => [p.id, p]));
        links.forEach(l => {
          if (!protDateMap.has(l.receptora_id)) {
            const p = pm.get(l.protocolo_id);
            if (p) protDateMap.set(l.receptora_id, { data_inicio: p.data_inicio, passo2_data: p.passo2_data });
          }
        });
      }
    }
  }

  // Passo 2
  if (emSinc.length > 0) {
    let minDias = Infinity;
    let prontas = 0;
    emSinc.forEach(r => {
      const info = protDateMap.get(r.id);
      if (info?.data_inicio) {
        const d = differenceInDays(addDays(new Date(info.data_inicio), PASSO2.IDEAL_MIN), hoje);
        minDias = Math.min(minDias, d);
        if (d <= 0) prontas++;
      }
    });
    if (minDias !== Infinity) {
      servicos.push({
        tipo: 'passo2', label: 'Segunda etapa do protocolo',
        total: emSinc.length, prontas,
        dias_mais_urgente: minDias,
        urgente: minDias <= 0,
      });
    }
  }

  // TE
  if (sincronizadas.length > 0) {
    let minDias = Infinity;
    let prontas = 0;
    sincronizadas.forEach(r => {
      const info = protDateMap.get(r.id);
      if (info?.passo2_data) {
        const d = differenceInDays(addDays(new Date(info.passo2_data), TE_RULES.DIAS_APOS_PASSO2), hoje);
        minDias = Math.min(minDias, d);
        if (d <= 0) prontas++;
      }
    });
    if (minDias !== Infinity) {
      servicos.push({
        tipo: 'te', label: 'Transferência de embriões',
        total: sincronizadas.length, prontas,
        dias_mais_urgente: minDias,
        urgente: minDias <= 0,
      });
    }
  }

  // DG
  if (servidas.length > 0) {
    let minDias = Infinity;
    let prontas = 0;
    servidas.forEach(r => {
      const dataTE = teDateMap.get(r.id);
      if (dataTE) {
        const d = differenceInDays(addDays(new Date(dataTE), DG_DIAS_APOS_TE), hoje);
        minDias = Math.min(minDias, d);
        if (d <= 0) prontas++;
      }
    });
    servicos.push({
      tipo: 'dg', label: 'Diagnóstico de prenhez',
      total: servidas.length, prontas,
      dias_mais_urgente: minDias === Infinity ? 99 : minDias,
      urgente: (minDias === Infinity ? 99 : minDias) <= 0,
    });
  }

  // Sexagem
  if (prenhesBase.length > 0) {
    let minDias = Infinity;
    let prontas = 0;
    prenhesBase.forEach(r => {
      const dataTE = teDateMap.get(r.id);
      if (dataTE) {
        const d = differenceInDays(addDays(new Date(dataTE), SEXAGEM_DIAS_APOS_TE), hoje);
        minDias = Math.min(minDias, d);
        if (d <= 0) prontas++;
      }
    });
    servicos.push({
      tipo: 'sexagem', label: 'Descobrir sexo dos bezerros',
      total: prenhesBase.length, prontas,
      dias_mais_urgente: minDias === Infinity ? 99 : minDias,
      urgente: (minDias === Infinity ? 99 : minDias) <= 0,
    });
  }

  // Parto
  const partosProximos = prenhesComParto.filter(r => {
    const d = differenceInDays(new Date(r.data_provavel_parto!), hoje);
    return d <= 30;
  });
  if (partosProximos.length > 0) {
    let minDias = Infinity;
    let urgentes = 0;
    partosProximos.forEach(r => {
      const d = differenceInDays(new Date(r.data_provavel_parto!), hoje);
      minDias = Math.min(minDias, d);
      if (d <= 3) urgentes++;
    });
    servicos.push({
      tipo: 'parto', label: 'Partos próximos',
      total: partosProximos.length, prontas: urgentes,
      dias_mais_urgente: minDias,
      urgente: minDias <= 3,
    });
  }

  servicos.sort((a, b) => a.dias_mais_urgente - b.dias_mais_urgente);
  return servicos;
}

// ==================== ÚLTIMOS RESULTADOS ====================

async function collectUltimosResultados(
  receptoraIds: string[],
  fazendaIds: string[],
  receptoraFazendaMap: Map<string, string>
) {
  const result: DailySummaryPayload['ultimos_resultados'] = {};

  if (receptoraIds.length === 0) return result;

  // Paralelo: TE, DG, Sexagem, Aspiração
  const [teData, dgData, sexagemData, aspData] = await Promise.all([
    collectUltimaTE(fazendaIds),
    collectUltimoDG(receptoraIds, receptoraFazendaMap),
    collectUltimaSexagem(receptoraIds, receptoraFazendaMap),
    collectUltimaAspiracao(fazendaIds),
  ]);

  if (teData) result.te = teData;
  if (dgData) result.dg = dgData;
  if (sexagemData) result.sexagem = sexagemData;
  if (aspData) result.aspiracao = aspData;

  return result;
}

async function collectUltimaTE(fazendaIds: string[]) {
  if (fazendaIds.length === 0) return null;

  const { data: protocolos } = await supabase
    .from('protocolos_sincronizacao')
    .select('id, fazenda_id, data_inicio')
    .in('fazenda_id', fazendaIds)
    .order('data_inicio', { ascending: false });

  if (!protocolos || protocolos.length === 0) return null;

  const ultimoProtocoloPorFazenda = new Map<string, string>();
  protocolos.forEach(p => {
    if (!ultimoProtocoloPorFazenda.has(p.fazenda_id)) {
      ultimoProtocoloPorFazenda.set(p.fazenda_id, p.id);
    }
  });

  const protocoloIds = Array.from(ultimoProtocoloPorFazenda.values());

  const { data: prData } = await supabase
    .from('protocolo_receptoras')
    .select('status')
    .in('protocolo_id', protocoloIds);

  if (!prData || prData.length === 0) return null;

  const sincronizadas = prData.length;
  const servidas = prData.filter(pr => pr.status === 'UTILIZADA').length;
  const taxa = sincronizadas > 0 ? Math.round((servidas / sincronizadas) * 100) : 0;

  return { sincronizadas, servidas, taxa };
}

async function collectUltimoDG(
  receptoraIds: string[],
  receptoraFazendaMap: Map<string, string>
) {
  const { data: dgs } = await supabase
    .from('diagnosticos_gestacao')
    .select('receptora_id, data_diagnostico, resultado')
    .in('receptora_id', receptoraIds)
    .eq('tipo_diagnostico', 'DG')
    .order('data_diagnostico', { ascending: false });

  if (!dgs || dgs.length === 0) return null;

  // Agrupar por fazenda+data, pegar última sessão por fazenda
  const grupos = new Map<string, typeof dgs>();
  dgs.forEach(dg => {
    const fazendaId = receptoraFazendaMap.get(dg.receptora_id);
    if (!fazendaId) return;
    const key = `${fazendaId}::${dg.data_diagnostico}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(dg);
  });

  const ultimaPorFazenda = new Map<string, typeof dgs>();
  for (const [key, grupo] of grupos) {
    const fazendaId = key.split('::')[0];
    if (!ultimaPorFazenda.has(fazendaId)) {
      ultimaPorFazenda.set(fazendaId, grupo);
    }
  }

  let total = 0;
  let prenhes = 0;
  for (const [, items] of ultimaPorFazenda) {
    total += items.length;
    prenhes += items.filter(dg =>
      dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')
    ).length;
  }

  const taxa = total > 0 ? Math.round((prenhes / total) * 100) : 0;
  return { total, prenhes, taxa };
}

async function collectUltimaSexagem(
  receptoraIds: string[],
  receptoraFazendaMap: Map<string, string>
) {
  const { data: sexagens } = await supabase
    .from('diagnosticos_gestacao')
    .select('receptora_id, data_diagnostico, resultado, sexagem')
    .in('receptora_id', receptoraIds)
    .eq('tipo_diagnostico', 'SEXAGEM')
    .order('data_diagnostico', { ascending: false });

  if (!sexagens || sexagens.length === 0) return null;

  const grupos = new Map<string, typeof sexagens>();
  sexagens.forEach(s => {
    const fazendaId = receptoraFazendaMap.get(s.receptora_id);
    if (!fazendaId) return;
    const key = `${fazendaId}::${s.data_diagnostico}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(s);
  });

  const ultimaPorFazenda = new Map<string, typeof sexagens>();
  for (const [key, grupo] of grupos) {
    const fazendaId = key.split('::')[0];
    if (!ultimaPorFazenda.has(fazendaId)) {
      ultimaPorFazenda.set(fazendaId, grupo);
    }
  }

  let total = 0;
  let femeas = 0;
  let machos = 0;
  let perdas = 0;
  for (const [, items] of ultimaPorFazenda) {
    total += items.length;
    femeas += items.filter(s => s.sexagem === 'FEMEA').length;
    machos += items.filter(s => s.sexagem === 'MACHO').length;
    perdas += items.filter(s => s.resultado === 'VAZIA' || s.sexagem === 'VAZIA').length;
  }

  return { total, femeas, machos, perdas };
}

async function collectUltimaAspiracao(fazendaIds: string[]) {
  if (fazendaIds.length === 0) return null;

  const { data: pacotes } = await supabase
    .from('pacotes_aspiracao')
    .select('id, fazenda_id, data_aspiracao')
    .in('fazenda_id', fazendaIds)
    .order('data_aspiracao', { ascending: false });

  if (!pacotes || pacotes.length === 0) return null;

  const ultimoPorFazenda = new Map<string, string>();
  pacotes.forEach(p => {
    if (!ultimoPorFazenda.has(p.fazenda_id)) {
      ultimoPorFazenda.set(p.fazenda_id, p.id);
    }
  });

  const pacoteIds = Array.from(ultimoPorFazenda.values());

  const { data: aspDoadoras } = await supabase
    .from('aspiracoes_doadoras')
    .select('doadora_id, viaveis')
    .in('pacote_aspiracao_id', pacoteIds);

  if (!aspDoadoras || aspDoadoras.length === 0) return null;

  const doadoras = new Set(aspDoadoras.map(a => a.doadora_id)).size;
  const oocitos = aspDoadoras.reduce((sum, a) => sum + (a.viaveis || 0), 0);
  const media = doadoras > 0 ? Math.round(oocitos / doadoras) : 0;

  return { doadoras, oocitos, media };
}

// ==================== ESTOQUE ====================

async function collectEstoque(clienteId: string, fazendaIds: string[]) {
  if (fazendaIds.length === 0) {
    return { doadoras: 0, doses_semen: 0, embrioes_congelados: 0 };
  }

  const [doadorasResult, dosesResult, embrioesResult] = await Promise.all([
    // Doadoras são por fazenda, não por cliente
    supabase
      .from('doadoras')
      .select('id')
      .in('fazenda_id', fazendaIds),
    supabase
      .from('doses_semen')
      .select('quantidade')
      .eq('cliente_id', clienteId)
      .gt('quantidade', 0),
    // Embriões são por cliente_id
    supabase
      .from('embrioes')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('status_atual', 'CONGELADO'),
  ]);

  const doadoras = doadorasResult.data?.length || 0;
  const doses_semen = dosesResult.data?.reduce((sum, d) => sum + (d.quantidade || 0), 0) || 0;
  const embrioes_congelados = embrioesResult.data?.length || 0;

  return { doadoras, doses_semen, embrioes_congelados };
}

// ==================== HOOK PRINCIPAL ====================

export function useDailySummary(clienteId: string | undefined, clienteNome?: string) {
  const todayStr = getTodayStr();
  const skipCacheRef = useRef(false);
  const queryClient = useQueryClient();
  const queryKey = ['daily-summary', clienteId, todayStr];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<DailySummaryResult> => {
      if (!clienteId) throw new Error('clienteId required');

      // 1. Checar cache (graceful se tabela não existir)
      if (!skipCacheRef.current) {
        try {
          const { data: cached } = await supabase
            .from('cliente_daily_summaries')
            .select('summary_text')
            .eq('cliente_id', clienteId)
            .eq('summary_date', todayStr)
            .maybeSingle();

          if (cached?.summary_text) {
            return { summary: cached.summary_text, isFromCache: true };
          }
        } catch {
          // Tabela pode não existir ainda — segue para gerar
        }
      }
      skipCacheRef.current = false;

      // 2. Coletar dados
      const payload = await collectDashboardData(clienteId, clienteNome || 'Cliente');

      // 3. Chamar Edge Function via fetch direto (evita bugs do supabase.functions.invoke)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const resp = await fetch(`${supabaseUrl}/functions/v1/daily-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Edge Function erro (${resp.status}): ${errText.substring(0, 200)}`);
      }

      const result = await resp.json();

      if (!result?.success || !result?.summary) {
        throw new Error(result?.error || 'Erro ao gerar resumo');
      }

      return { summary: result.summary, isFromCache: false };
    },
    enabled: !!clienteId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const regenerate = () => {
    // Limpar dados do React Query para mostrar loading
    queryClient.setQueryData(queryKey, undefined);
    // Deletar cache do banco
    if (clienteId) {
      (async () => {
        try {
          await supabase
            .from('cliente_daily_summaries')
            .delete()
            .eq('cliente_id', clienteId)
            .eq('summary_date', todayStr);
        } catch {
          // Ignore
        }
      })();
    }
    skipCacheRef.current = true;
    query.refetch();
  };

  return { ...query, regenerate };
}
