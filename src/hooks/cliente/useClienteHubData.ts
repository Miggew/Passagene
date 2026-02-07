/**
 * Hook de cache compartilhado para o Hub do Cliente
 *
 * Centraliza o carregamento de dados e usa React Query para cache entre páginas.
 * Reduz drasticamente o número de queries ao navegar entre as abas do hub.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ==================== TIPOS ====================

export interface Fazenda {
  id: string;
  nome: string;
}

export interface ReceptoraBase {
  id: string;
  identificacao?: string;
  status_reprodutivo?: string;
  data_provavel_parto?: string;
  fazenda_id?: string;
  fazenda_nome?: string;
}

export interface DoadoraBase {
  id: string;
  nome?: string;
  registro?: string;
  raca?: string;
  fazenda_id?: string;
}

export interface TouroComDoses {
  id: string;
  nome: string;
  registro?: string;
  raca?: string;
  totalDoses: number;
  tipos: string[];
}

export interface EmbriaoBase {
  id: string;
  classificacao?: string;
  status_atual?: string;
  lote_fiv_acasalamento_id?: string;
}

export interface ClienteHubData {
  fazendas: Fazenda[];
  fazendaIds: string[];
  fazendaNomeMap: Map<string, string>;
  receptoras: ReceptoraBase[];
  receptoraIds: string[];
  receptoraFazendaMap: Map<string, string>;
  doadoras: DoadoraBase[];
  doadoraIds: string[];
  // Botijão
  tourosDoses: TouroComDoses[];
  totalDoses: number;
  embrioes: EmbriaoBase[];
  totalEmbrioes: number;
}

// ==================== FUNÇÕES DE FETCH ====================

/**
 * Carrega todos os dados base do cliente em paralelo
 */
async function fetchClienteHubData(clienteId: string): Promise<ClienteHubData> {
  // ===== FASE 1: Fazendas (base para tudo) =====
  const { data: fazendasData, error: fazendasError } = await supabase
    .from('fazendas')
    .select('id, nome')
    .eq('cliente_id', clienteId)
    .order('nome');

  if (fazendasError) throw fazendasError;

  const fazendas = fazendasData || [];
  const fazendaIds = fazendas.map(f => f.id);
  const fazendaNomeMap = new Map(fazendas.map(f => [f.id, f.nome]));

  if (fazendaIds.length === 0) {
    return {
      fazendas: [],
      fazendaIds: [],
      fazendaNomeMap: new Map(),
      receptoras: [],
      receptoraIds: [],
      receptoraFazendaMap: new Map(),
      doadoras: [],
      doadoraIds: [],
      tourosDoses: [],
      totalDoses: 0,
      embrioes: [],
      totalEmbrioes: 0,
    };
  }

  // ===== FASE 2: Queries em paralelo =====
  const [
    receptorasViewResult,
    doadorasResult,
    dosesResult,
    embrioesResult,
  ] = await Promise.all([
    // Receptoras via view
    supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id, fazenda_id_atual')
      .eq('cliente_id', clienteId),
    // Doadoras
    supabase
      .from('doadoras')
      .select('id, nome, registro, raca, fazenda_id')
      .in('fazenda_id', fazendaIds)
      .order('nome'),
    // Doses de sêmen
    supabase
      .from('doses_semen')
      .select('id, quantidade, tipo_semen, touro_id')
      .eq('cliente_id', clienteId)
      .gt('quantidade', 0),
    // Embriões congelados
    supabase
      .from('embrioes')
      .select('id, classificacao, status_atual, lote_fiv_acasalamento_id')
      .eq('cliente_id', clienteId)
      .eq('status_atual', 'CONGELADO'),
  ]);

  // Processar receptoras
  const receptorasView = receptorasViewResult.data || [];
  const receptoraIds = receptorasView.map(r => r.receptora_id);
  const receptoraFazendaMap = new Map(
    receptorasView.map(r => [r.receptora_id, r.fazenda_id_atual])
  );

  // Buscar detalhes das receptoras se houver
  let receptoras: ReceptoraBase[] = [];
  if (receptoraIds.length > 0) {
    const { data: receptorasData } = await supabase
      .from('receptoras')
      .select('id, identificacao, status_reprodutivo, data_provavel_parto')
      .in('id', receptoraIds)
      .order('identificacao');

    receptoras = (receptorasData || []).map(r => ({
      ...r,
      fazenda_id: receptoraFazendaMap.get(r.id),
      fazenda_nome: receptoraFazendaMap.get(r.id)
        ? fazendaNomeMap.get(receptoraFazendaMap.get(r.id)!)
        : undefined,
    }));
  }

  // Processar doadoras
  const doadoras = doadorasResult.data || [];
  const doadoraIds = doadoras.map(d => d.id);

  // Processar doses - agrupar por touro
  const dosesData = dosesResult.data || [];
  const touroIds = [...new Set(dosesData.map(d => d.touro_id).filter(Boolean))];

  let tourosDoses: TouroComDoses[] = [];
  let totalDoses = 0;

  if (touroIds.length > 0) {
    const { data: tourosData } = await supabase
      .from('touros')
      .select('id, nome, registro, raca')
      .in('id', touroIds);

    const tourosMap = new Map(
      tourosData?.map(t => [t.id, { nome: t.nome, registro: t.registro, raca: t.raca }]) || []
    );

    const dosesPorTouro = new Map<string, { totalDoses: number; tipos: Set<string> }>();

    dosesData.forEach(dose => {
      if (dose.touro_id) {
        const current = dosesPorTouro.get(dose.touro_id) || { totalDoses: 0, tipos: new Set<string>() };
        current.totalDoses += dose.quantidade || 0;
        if (dose.tipo_semen) current.tipos.add(dose.tipo_semen);
        dosesPorTouro.set(dose.touro_id, current);
        totalDoses += dose.quantidade || 0;
      }
    });

    dosesPorTouro.forEach((stats, touroId) => {
      const touro = tourosMap.get(touroId);
      if (touro) {
        tourosDoses.push({
          id: touroId,
          nome: touro.nome,
          registro: touro.registro,
          raca: touro.raca,
          totalDoses: stats.totalDoses,
          tipos: Array.from(stats.tipos),
        });
      }
    });

    tourosDoses.sort((a, b) => b.totalDoses - a.totalDoses);
  }

  // Processar embriões
  const embrioes = embrioesResult.data || [];

  return {
    fazendas,
    fazendaIds,
    fazendaNomeMap,
    receptoras,
    receptoraIds,
    receptoraFazendaMap,
    doadoras,
    doadoraIds,
    tourosDoses,
    totalDoses,
    embrioes,
    totalEmbrioes: embrioes.length,
  };
}

// ==================== HOOK PRINCIPAL ====================

/**
 * Hook principal que carrega e cacheia todos os dados do hub do cliente.
 * Usa React Query para compartilhar dados entre páginas.
 */
export function useClienteHubData(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-hub-data', clienteId],
    queryFn: () => fetchClienteHubData(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos no cache
  });
}

// ==================== HOOKS AUXILIARES ====================

/**
 * Hook para buscar estatísticas de aspirações das doadoras
 */
export function useDoadorasStats(doadoraIds: string[]) {
  return useQuery({
    queryKey: ['doadoras-stats', doadoraIds],
    queryFn: async () => {
      if (doadoraIds.length === 0) return new Map<string, { total: number; soma: number }>();

      const { data: aspiracoes } = await supabase
        .from('aspiracoes_doadoras')
        .select('doadora_id, viaveis')
        .in('doadora_id', doadoraIds);

      const statsPorDoadora = new Map<string, { total: number; soma: number }>();
      aspiracoes?.forEach(a => {
        const stats = statsPorDoadora.get(a.doadora_id) || { total: 0, soma: 0 };
        stats.total++;
        stats.soma += a.viaveis || 0;
        statsPorDoadora.set(a.doadora_id, stats);
      });

      return statsPorDoadora;
    },
    enabled: doadoraIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para buscar cruzamentos (doadora × touro) das receptoras prenhes
 */
export function useReceptorasCruzamento(prenhesIds: string[]) {
  return useQuery({
    queryKey: ['receptoras-cruzamento', prenhesIds],
    queryFn: async () => {
      if (prenhesIds.length === 0) return new Map<string, { doadora: string; touro: string }>();

      // Buscar transferências
      const { data: transferencias } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id, embriao_id')
        .in('receptora_id', prenhesIds);

      if (!transferencias || transferencias.length === 0) {
        return new Map<string, { doadora: string; touro: string }>();
      }

      const embriaoIds = [...new Set(transferencias.map(t => t.embriao_id).filter(Boolean))];

      // Buscar embriões e acasalamentos em paralelo
      const { data: embrioes } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id')
        .in('id', embriaoIds);

      if (!embrioes || embrioes.length === 0) {
        return new Map<string, { doadora: string; touro: string }>();
      }

      const acasalamentoIds = [...new Set(embrioes.map(e => e.lote_fiv_acasalamento_id).filter(Boolean))];

      if (acasalamentoIds.length === 0) {
        return new Map<string, { doadora: string; touro: string }>();
      }

      // Buscar acasalamentos
      const { data: acasalamentos } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIds);

      if (!acasalamentos || acasalamentos.length === 0) {
        return new Map<string, { doadora: string; touro: string }>();
      }

      const aspiracaoIds = acasalamentos.map(a => a.aspiracao_doadora_id).filter(Boolean);
      const doseIds = acasalamentos.map(a => a.dose_semen_id).filter(Boolean);

      // Buscar aspirações, doadoras, doses e touros em paralelo
      const [aspiracaoResult, doseResult] = await Promise.all([
        aspiracaoIds.length > 0
          ? supabase.from('aspiracoes_doadoras').select('id, doadora_id').in('id', aspiracaoIds)
          : { data: [] },
        doseIds.length > 0
          ? supabase.from('doses_semen').select('id, touro_id').in('id', doseIds)
          : { data: [] },
      ]);

      const aspiracaoDoadoraMap = new Map<string, string>();
      aspiracaoResult.data?.forEach(a => aspiracaoDoadoraMap.set(a.id, a.doadora_id));

      const doseTouroMap = new Map<string, string>();
      doseResult.data?.forEach(d => doseTouroMap.set(d.id, d.touro_id));

      const doadoraIds = [...new Set(Array.from(aspiracaoDoadoraMap.values()).filter(Boolean))];
      const touroIds = [...new Set(Array.from(doseTouroMap.values()).filter(Boolean))];

      // Buscar nomes em paralelo
      const [doadorasResult, tourosResult] = await Promise.all([
        doadoraIds.length > 0
          ? supabase.from('doadoras').select('id, nome, registro').in('id', doadoraIds)
          : { data: [] },
        touroIds.length > 0
          ? supabase.from('touros').select('id, nome').in('id', touroIds)
          : { data: [] },
      ]);

      const doadoraNomeMap = new Map<string, string>();
      doadorasResult.data?.forEach(d => doadoraNomeMap.set(d.id, d.nome || d.registro || ''));

      const touroNomeMap = new Map<string, string>();
      tourosResult.data?.forEach(t => touroNomeMap.set(t.id, t.nome || ''));

      // Montar mapa acasalamento -> cruzamento
      const acasalamentoCruzamentoMap = new Map<string, { doadora: string; touro: string }>();
      acasalamentos.forEach(ac => {
        const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
        const touroId = doseTouroMap.get(ac.dose_semen_id);
        acasalamentoCruzamentoMap.set(ac.id, {
          doadora: doadoraId ? doadoraNomeMap.get(doadoraId) || '' : '',
          touro: touroId ? touroNomeMap.get(touroId) || '' : '',
        });
      });

      // Montar mapa embrião -> cruzamento
      const embriaoCruzamentoMap = new Map<string, { doadora: string; touro: string }>();
      embrioes.forEach(e => {
        if (e.lote_fiv_acasalamento_id && acasalamentoCruzamentoMap.has(e.lote_fiv_acasalamento_id)) {
          embriaoCruzamentoMap.set(e.id, acasalamentoCruzamentoMap.get(e.lote_fiv_acasalamento_id)!);
        }
      });

      // Montar mapa receptora -> cruzamento
      const receptoraCruzamentoMap = new Map<string, { doadora: string; touro: string }>();
      transferencias.forEach(t => {
        if (t.embriao_id && embriaoCruzamentoMap.has(t.embriao_id)) {
          receptoraCruzamentoMap.set(t.receptora_id, embriaoCruzamentoMap.get(t.embriao_id)!);
        }
      });

      return receptoraCruzamentoMap;
    },
    enabled: prenhesIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para buscar detalhes de embriões (doadora e touro)
 */
export function useEmbrioesDetalhes(acasalamentoIds: string[]) {
  return useQuery({
    queryKey: ['embrioes-detalhes', acasalamentoIds],
    queryFn: async () => {
      if (acasalamentoIds.length === 0) {
        return {
          doadoraMap: new Map<string, { nome: string; id: string }>(),
          touroMap: new Map<string, { nome: string; id: string }>(),
        };
      }

      // Buscar acasalamentos
      const { data: acasalamentos } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, dose_semen_id, aspiracao_doadora_id')
        .in('id', acasalamentoIds);

      if (!acasalamentos || acasalamentos.length === 0) {
        return {
          doadoraMap: new Map<string, { nome: string; id: string }>(),
          touroMap: new Map<string, { nome: string; id: string }>(),
        };
      }

      const doseSemenIds = [...new Set(acasalamentos.map(a => a.dose_semen_id).filter(Boolean))];
      const aspiracaoIds = [...new Set(acasalamentos.map(a => a.aspiracao_doadora_id).filter(Boolean))];

      // Buscar doses e aspirações em paralelo
      const [dosesResult, aspiracoesResult] = await Promise.all([
        doseSemenIds.length > 0
          ? supabase.from('doses_semen').select('id, touro_id').in('id', doseSemenIds)
          : { data: [] },
        aspiracaoIds.length > 0
          ? supabase.from('aspiracoes_doadoras').select('id, doadora_id').in('id', aspiracaoIds)
          : { data: [] },
      ]);

      const doseTouroMap = new Map<string, string>();
      dosesResult.data?.forEach(d => doseTouroMap.set(d.id, d.touro_id));

      const aspiracaoDoadoraMap = new Map<string, string>();
      aspiracoesResult.data?.forEach(a => aspiracaoDoadoraMap.set(a.id, a.doadora_id));

      const touroIds = [...new Set(Array.from(doseTouroMap.values()).filter(Boolean))];
      const doadoraIds = [...new Set(Array.from(aspiracaoDoadoraMap.values()).filter(Boolean))];

      // Buscar nomes em paralelo
      const [tourosResult, doadorasResult] = await Promise.all([
        touroIds.length > 0
          ? supabase.from('touros').select('id, nome').in('id', touroIds)
          : { data: [] },
        doadoraIds.length > 0
          ? supabase.from('doadoras').select('id, nome, registro').in('id', doadoraIds)
          : { data: [] },
      ]);

      const touroNomeMap = new Map<string, string>();
      tourosResult.data?.forEach(t => touroNomeMap.set(t.id, t.nome || ''));

      const doadoraNomeMap = new Map<string, string>();
      doadorasResult.data?.forEach(d => doadoraNomeMap.set(d.id, d.nome || d.registro || ''));

      // Mapear acasalamento -> touro e doadora
      const touroMap = new Map<string, { nome: string; id: string }>();
      const doadoraMap = new Map<string, { nome: string; id: string }>();

      acasalamentos.forEach(ac => {
        // Touro
        if (ac.dose_semen_id) {
          const touroId = doseTouroMap.get(ac.dose_semen_id);
          if (touroId) {
            const nome = touroNomeMap.get(touroId) || '';
            touroMap.set(ac.id, { nome, id: touroId });
          }
        }
        // Doadora
        if (ac.aspiracao_doadora_id) {
          const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
          if (doadoraId) {
            const nome = doadoraNomeMap.get(doadoraId) || '';
            doadoraMap.set(ac.id, { nome, id: doadoraId });
          }
        }
      });

      return { doadoraMap, touroMap };
    },
    enabled: acasalamentoIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
