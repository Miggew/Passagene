import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PeriodoSelecionado } from '@/components/charts/PeriodSelector';

interface KPIComparativo {
  atual: number;
  anterior: number | null;
  delta: number | null;
  deltaPercent: number | null;
  total: number;
  totalAnterior: number | null;
}

interface RankingItem {
  id: string;
  nome: string;
  valor: number;
  valorAnterior?: number;
  delta?: number;
  total?: number;
  totalBase?: number;
}

interface TendenciaMensal {
  mes: string;
  mesLabel: string;
  valorAtual?: number;
  valorAnterior?: number;
}

interface KPIData {
  taxaPrenhez: KPIComparativo;
  taxaVirada: KPIComparativo;
  totalTEs: number;
  totalDGs: number;
  tendenciaPrenhez: TendenciaMensal[];
  rankingTouros: RankingItem[];
  rankingFazendas: RankingItem[];
  rankingDoadoras: RankingItem[];
  rankingVeterinarios: RankingItem[];
  rankingTecnicos: RankingItem[];
}

interface UseKPIDataParams {
  periodo: PeriodoSelecionado;
  fazendaId?: string;
  clienteId?: string;
}

const INITIAL_KPI: KPIComparativo = {
  atual: 0,
  anterior: null,
  delta: null,
  deltaPercent: null,
  total: 0,
  totalAnterior: null,
};

const INITIAL_DATA: KPIData = {
  taxaPrenhez: INITIAL_KPI,
  taxaVirada: INITIAL_KPI,
  totalTEs: 0,
  totalDGs: 0,
  tendenciaPrenhez: [],
  rankingTouros: [],
  rankingFazendas: [],
  rankingDoadoras: [],
  rankingVeterinarios: [],
  rankingTecnicos: [],
};

// Helper para dividir arrays em chunks (evita URLs muito longas)
const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

const CHUNK_SIZE = 10; // Máximo de IDs por query

export function useKPIData({ periodo, fazendaId, clienteId }: UseKPIDataParams) {
  const [data, setData] = useState<KPIData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Formatar datas para query
  const formatDateForQuery = (date: Date) => format(date, 'yyyy-MM-dd');

  // Buscar taxa de prenhez
  const fetchTaxaPrenhez = useCallback(async (
    inicio: Date,
    fim: Date,
    fazendaIds?: string[]
  ): Promise<{ taxa: number; total: number; prenhes: number }> => {
    let query = supabase
      .from('diagnosticos_gestacao')
      .select('id, resultado')
      .gte('data_diagnostico', formatDateForQuery(inicio))
      .lte('data_diagnostico', formatDateForQuery(fim));

    // Filtrar por fazenda se necessário (via receptoras)
    // Por simplicidade, vamos buscar todos e filtrar se necessário

    const { data: dgs, error } = await query;

    if (error) throw error;

    const total = dgs?.length ?? 0;
    const prenhes = dgs?.filter(d =>
      d.resultado === 'PRENHE' ||
      d.resultado?.startsWith('PRENHE_')
    ).length ?? 0;

    const taxa = total > 0 ? (prenhes / total) * 100 : 0;

    return { taxa, total, prenhes };
  }, []);

  // Buscar taxa de virada (oócitos -> embriões)
  const fetchTaxaVirada = useCallback(async (
    inicio: Date,
    fim: Date
  ): Promise<{ taxa: number; oocitos: number; embrioes: number }> => {
    // Buscar pacotes de aspiração no período
    const { data: pacotes } = await supabase
      .from('pacotes_aspiracao')
      .select('id')
      .gte('data_aspiracao', formatDateForQuery(inicio))
      .lte('data_aspiracao', formatDateForQuery(fim));

    const pacoteIds = pacotes?.map(p => p.id) ?? [];

    if (pacoteIds.length === 0) {
      return { taxa: 0, oocitos: 0, embrioes: 0 };
    }

    // Buscar total de oócitos em chunks
    const pacoteChunks = chunkArray(pacoteIds, CHUNK_SIZE);
    let oocitos = 0;

    for (const chunk of pacoteChunks) {
      const { data: aspiracoes } = await supabase
        .from('aspiracoes_doadoras')
        .select('total_oocitos')
        .in('pacote_aspiracao_id', chunk);
      oocitos += aspiracoes?.reduce((acc, a) => acc + (a.total_oocitos ?? 0), 0) ?? 0;
    }

    // Buscar lotes FIV desses pacotes em chunks
    const allLoteIds: string[] = [];
    for (const chunk of pacoteChunks) {
      const { data: lotes } = await supabase
        .from('lotes_fiv')
        .select('id')
        .in('pacote_aspiracao_id', chunk);
      if (lotes) {
        allLoteIds.push(...lotes.map(l => l.id));
      }
    }

    if (allLoteIds.length === 0) {
      return { taxa: 0, oocitos, embrioes: 0 };
    }

    // Contar embriões viáveis em chunks
    const loteChunks = chunkArray(allLoteIds, CHUNK_SIZE);
    let totalEmbrioes = 0;

    for (const chunk of loteChunks) {
      const { count } = await supabase
        .from('embrioes')
        .select('id', { count: 'exact', head: true })
        .in('lote_fiv_id', chunk)
        .in('classificacao', ['A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI']);
      totalEmbrioes += count ?? 0;
    }

    const taxa = oocitos > 0 ? (totalEmbrioes / oocitos) * 100 : 0;

    return { taxa, oocitos, embrioes: totalEmbrioes };
  }, []);

  // Buscar ranking de touros por taxa de virada
  const fetchRankingTouros = useCallback(async (
    inicio: Date,
    fim: Date
  ): Promise<RankingItem[]> => {
    // Primeiro buscar lotes FIV no período
    const { data: lotes } = await supabase
      .from('lotes_fiv')
      .select('id')
      .gte('data_abertura', formatDateForQuery(inicio))
      .lte('data_abertura', formatDateForQuery(fim));

    const loteIds = lotes?.map(l => l.id) ?? [];

    if (loteIds.length === 0) {
      return [];
    }

    // Buscar acasalamentos desses lotes em chunks
    const loteChunks = chunkArray(loteIds, CHUNK_SIZE);
    const allAcasalamentos: any[] = [];

    for (const chunk of loteChunks) {
      const { data: acasalamentos } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('lote_fiv_id', chunk)
        .not('dose_semen_id', 'is', null);
      if (acasalamentos) {
        allAcasalamentos.push(...acasalamentos);
      }
    }

    if (allAcasalamentos.length === 0) {
      return [];
    }

    // Buscar aspirações para obter viaveis (oócitos)
    const aspiracaoIds = [...new Set(allAcasalamentos.map(a => a.aspiracao_doadora_id).filter(Boolean))];
    const aspiracaoViaveisMap = new Map<string, number>();

    if (aspiracaoIds.length > 0) {
      const aspiracaoChunks = chunkArray(aspiracaoIds, CHUNK_SIZE);
      for (const chunk of aspiracaoChunks) {
        const { data: aspiracoes } = await supabase
          .from('aspiracoes_doadoras')
          .select('id, viaveis')
          .in('id', chunk);
        aspiracoes?.forEach(a => {
          if (a.viaveis) aspiracaoViaveisMap.set(a.id, a.viaveis);
        });
      }
    }

    // Contar embriões por acasalamento (da tabela embrioes)
    const acasalamentoIds = allAcasalamentos.map(a => a.id);
    const embrioesPorAcasalamento = new Map<string, number>();

    if (acasalamentoIds.length > 0) {
      const acasalamentoChunks = chunkArray(acasalamentoIds, CHUNK_SIZE);
      for (const chunk of acasalamentoChunks) {
        const { data: embrioes } = await supabase
          .from('embrioes')
          .select('lote_fiv_acasalamento_id')
          .in('lote_fiv_acasalamento_id', chunk)
          .in('classificacao', ['A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI']);
        embrioes?.forEach(e => {
          if (e.lote_fiv_acasalamento_id) {
            const count = embrioesPorAcasalamento.get(e.lote_fiv_acasalamento_id) ?? 0;
            embrioesPorAcasalamento.set(e.lote_fiv_acasalamento_id, count + 1);
          }
        });
      }
    }

    // Buscar doses de sêmen para obter touro_id
    const doseIds = [...new Set(allAcasalamentos.map(a => a.dose_semen_id).filter(Boolean))];
    const doseTouroMap = new Map<string, string>();

    if (doseIds.length > 0) {
      const doseChunks = chunkArray(doseIds, CHUNK_SIZE);
      for (const chunk of doseChunks) {
        const { data: doses } = await supabase
          .from('doses_semen')
          .select('id, touro_id')
          .in('id', chunk);
        doses?.forEach(d => {
          if (d.touro_id) doseTouroMap.set(d.id, d.touro_id);
        });
      }
    }

    // Buscar nomes dos touros
    const touroIds = [...new Set(Array.from(doseTouroMap.values()))];
    const touroNomeMap = new Map<string, string>();

    if (touroIds.length > 0) {
      const touroChunks = chunkArray(touroIds, CHUNK_SIZE);
      for (const chunk of touroChunks) {
        const { data: touros } = await supabase
          .from('touros')
          .select('id, nome')
          .in('id', chunk);
        touros?.forEach(t => touroNomeMap.set(t.id, t.nome));
      }
    }

    // Agrupar por touro
    const porTouro = new Map<string, { nome: string; oocitos: number; embrioes: number }>();

    allAcasalamentos.forEach((a: any) => {
      const touroId = doseTouroMap.get(a.dose_semen_id);
      if (!touroId) return;

      const touroNome = touroNomeMap.get(touroId) ?? 'Sem nome';
      const current = porTouro.get(touroId) ?? { nome: touroNome, oocitos: 0, embrioes: 0 };
      current.oocitos += aspiracaoViaveisMap.get(a.aspiracao_doadora_id) ?? 0;
      current.embrioes += embrioesPorAcasalamento.get(a.id) ?? 0;
      porTouro.set(touroId, current);
    });

    // Converter para ranking
    const ranking: RankingItem[] = [];
    porTouro.forEach((value, key) => {
      if (value.oocitos > 0) {
        ranking.push({
          id: key,
          nome: value.nome,
          valor: (value.embrioes / value.oocitos) * 100,
          total: value.embrioes,
          totalBase: value.oocitos,
        });
      }
    });

    // Ordenar por taxa descendente
    return ranking.sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, []);

  // Buscar ranking de fazendas por taxa de prenhez
  const fetchRankingFazendas = useCallback(async (
    inicio: Date,
    fim: Date
  ): Promise<RankingItem[]> => {
    // Buscar DGs no período
    const { data: dgs } = await supabase
      .from('diagnosticos_gestacao')
      .select('id, resultado, receptora_id')
      .gte('data_diagnostico', formatDateForQuery(inicio))
      .lte('data_diagnostico', formatDateForQuery(fim));

    if (!dgs || dgs.length === 0) {
      return [];
    }

    // Buscar fazenda atual das receptoras via view
    const receptoraIds = [...new Set(dgs.map(d => d.receptora_id).filter(Boolean))];

    if (receptoraIds.length === 0) {
      return [];
    }

    // Buscar em chunks
    const receptoraChunks = chunkArray(receptoraIds, CHUNK_SIZE);
    const receptoraFazendaMap = new Map<string, { fazenda_id: string; fazenda_nome: string }>();

    for (const chunk of receptoraChunks) {
      const { data: receptoras } = await supabase
        .from('receptoras')
        .select('id, fazenda_atual_id, fazendas(nome)')
        .in('id', chunk);

      receptoras?.forEach(r => {
        if (r.fazenda_atual_id && r.fazendas) {
          receptoraFazendaMap.set(r.id, {
            fazenda_id: r.fazenda_atual_id,
            fazenda_nome: ((r.fazendas as unknown) as { nome: string }).nome || 'Sem nome',
          });
        }
      });
    }

    // Agrupar por fazenda
    const porFazenda = new Map<string, { nome: string; total: number; prenhes: number }>();

    dgs.forEach((dg: any) => {
      const fazendaInfo = receptoraFazendaMap.get(dg.receptora_id);
      if (!fazendaInfo) return;

      const current = porFazenda.get(fazendaInfo.fazenda_id) ?? { nome: fazendaInfo.fazenda_nome, total: 0, prenhes: 0 };
      current.total += 1;
      if (dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')) {
        current.prenhes += 1;
      }
      porFazenda.set(fazendaInfo.fazenda_id, current);
    });

    // Converter para ranking
    const ranking: RankingItem[] = [];
    porFazenda.forEach((value, key) => {
      if (value.total >= 5) { // Mínimo de 5 DGs para entrar no ranking
        ranking.push({
          id: key,
          nome: value.nome,
          valor: (value.prenhes / value.total) * 100,
          total: value.prenhes,
          totalBase: value.total,
        });
      }
    });

    return ranking.sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, []);

  // Buscar ranking de doadoras por taxa de virada
  const fetchRankingDoadoras = useCallback(async (
    inicio: Date,
    fim: Date
  ): Promise<RankingItem[]> => {
    // Primeiro buscar lotes FIV no período (quando a FIV foi processada)
    const { data: lotes } = await supabase
      .from('lotes_fiv')
      .select('id')
      .gte('data_abertura', formatDateForQuery(inicio))
      .lte('data_abertura', formatDateForQuery(fim));

    const loteIds = lotes?.map(l => l.id) ?? [];

    if (loteIds.length === 0) {
      return [];
    }

    // Buscar acasalamentos desses lotes em chunks
    const loteChunks = chunkArray(loteIds, CHUNK_SIZE);
    const allAcasalamentos: any[] = [];

    for (const chunk of loteChunks) {
      const { data: acasalamentos } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id')
        .in('lote_fiv_id', chunk);
      if (acasalamentos) {
        allAcasalamentos.push(...acasalamentos);
      }
    }

    if (allAcasalamentos.length === 0) {
      return [];
    }

    // Buscar aspirações para obter doadora_id e viaveis (oócitos)
    const aspiracaoIds = [...new Set(allAcasalamentos.map(a => a.aspiracao_doadora_id).filter(Boolean))];
    const aspiracaoInfoMap = new Map<string, { doadora_id: string; viaveis: number }>();

    if (aspiracaoIds.length > 0) {
      const aspiracaoChunks = chunkArray(aspiracaoIds, CHUNK_SIZE);
      for (const chunk of aspiracaoChunks) {
        const { data: aspiracoes } = await supabase
          .from('aspiracoes_doadoras')
          .select('id, doadora_id, viaveis')
          .in('id', chunk);
        aspiracoes?.forEach(a => {
          if (a.doadora_id) {
            aspiracaoInfoMap.set(a.id, {
              doadora_id: a.doadora_id,
              viaveis: a.viaveis ?? 0,
            });
          }
        });
      }
    }

    // Contar embriões por acasalamento (da tabela embrioes)
    const acasalamentoIds = allAcasalamentos.map(a => a.id);
    const embrioesPorAcasalamento = new Map<string, number>();

    if (acasalamentoIds.length > 0) {
      const acasalamentoChunks = chunkArray(acasalamentoIds, CHUNK_SIZE);
      for (const chunk of acasalamentoChunks) {
        const { data: embrioes } = await supabase
          .from('embrioes')
          .select('lote_fiv_acasalamento_id')
          .in('lote_fiv_acasalamento_id', chunk)
          .in('classificacao', ['A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI']);
        embrioes?.forEach(e => {
          if (e.lote_fiv_acasalamento_id) {
            const count = embrioesPorAcasalamento.get(e.lote_fiv_acasalamento_id) ?? 0;
            embrioesPorAcasalamento.set(e.lote_fiv_acasalamento_id, count + 1);
          }
        });
      }
    }

    // Buscar dados das doadoras
    const doadoraIds = [...new Set(Array.from(aspiracaoInfoMap.values()).map(a => a.doadora_id))];
    const doadoraMap = new Map<string, { id: string; nome: string; registro: string }>();

    if (doadoraIds.length > 0) {
      const doadoraChunks = chunkArray(doadoraIds, CHUNK_SIZE);
      for (const chunk of doadoraChunks) {
        const { data: doadoras } = await supabase
          .from('doadoras')
          .select('id, nome, registro')
          .in('id', chunk);
        doadoras?.forEach(d => doadoraMap.set(d.id, d));
      }
    }

    // Agrupar por doadora
    const porDoadora = new Map<string, { nome: string; oocitos: number; embrioes: number }>();

    allAcasalamentos.forEach((a: any) => {
      const aspiracaoInfo = aspiracaoInfoMap.get(a.aspiracao_doadora_id);
      if (!aspiracaoInfo) return;

      const doadora = doadoraMap.get(aspiracaoInfo.doadora_id);
      if (!doadora) return;

      const nomeDisplay = doadora.nome || doadora.registro || 'Sem nome';
      const current = porDoadora.get(aspiracaoInfo.doadora_id) ?? { nome: nomeDisplay, oocitos: 0, embrioes: 0 };
      current.oocitos += aspiracaoInfo.viaveis;
      current.embrioes += embrioesPorAcasalamento.get(a.id) ?? 0;
      porDoadora.set(aspiracaoInfo.doadora_id, current);
    });

    // Converter para ranking
    const ranking: RankingItem[] = [];
    porDoadora.forEach((value, key) => {
      if (value.oocitos >= 10) { // Mínimo de 10 oócitos para entrar no ranking
        ranking.push({
          id: key,
          nome: value.nome,
          valor: (value.embrioes / value.oocitos) * 100,
          total: value.embrioes,
          totalBase: value.oocitos,
        });
      }
    });

    return ranking.sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, []);

  // Buscar ranking de veterinários/técnicos
  const fetchRankingResponsaveis = useCallback(async (
    inicio: Date,
    fim: Date,
    campo: 'veterinario_responsavel' | 'tecnico_responsavel'
  ): Promise<RankingItem[]> => {
    const { data: dgs } = await supabase
      .from('diagnosticos_gestacao')
      .select(`id, resultado, ${campo}`)
      .gte('data_diagnostico', formatDateForQuery(inicio))
      .lte('data_diagnostico', formatDateForQuery(fim))
      .not(campo, 'is', null);

    if (!dgs || dgs.length === 0) {
      return [];
    }

    // Agrupar por responsável
    const porResponsavel = new Map<string, { total: number; prenhes: number }>();

    dgs.forEach((dg: any) => {
      const nome = dg[campo];
      if (!nome) return;

      const current = porResponsavel.get(nome) ?? { total: 0, prenhes: 0 };
      current.total += 1;
      if (dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')) {
        current.prenhes += 1;
      }
      porResponsavel.set(nome, current);
    });

    // Converter para ranking
    const ranking: RankingItem[] = [];
    porResponsavel.forEach((value, key) => {
      if (value.total >= 10) { // Mínimo de 10 DGs para entrar no ranking
        ranking.push({
          id: key,
          nome: key,
          valor: (value.prenhes / value.total) * 100,
          total: value.prenhes,
          totalBase: value.total,
        });
      }
    });

    return ranking.sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, []);

  // Buscar tendência mensal de prenhez
  const fetchTendenciaPrenhez = useCallback(async (
    periodo: PeriodoSelecionado
  ): Promise<TendenciaMensal[]> => {
    // Gerar lista de meses do período atual
    const mesesAtual = eachMonthOfInterval({ start: periodo.inicio, end: periodo.fim });
    const mesesAnterior = eachMonthOfInterval({ start: periodo.inicioAnterior, end: periodo.fimAnterior });

    // Buscar todos os DGs do período atual
    const { data: dgsAtual } = await supabase
      .from('diagnosticos_gestacao')
      .select('id, resultado, data_diagnostico')
      .gte('data_diagnostico', formatDateForQuery(periodo.inicio))
      .lte('data_diagnostico', formatDateForQuery(periodo.fim));

    // Buscar todos os DGs do período anterior
    const { data: dgsAnterior } = await supabase
      .from('diagnosticos_gestacao')
      .select('id, resultado, data_diagnostico')
      .gte('data_diagnostico', formatDateForQuery(periodo.inicioAnterior))
      .lte('data_diagnostico', formatDateForQuery(periodo.fimAnterior));

    // Calcular taxa por mês (atual)
    const taxaPorMesAtual = new Map<string, { total: number; prenhes: number }>();
    dgsAtual?.forEach(dg => {
      const mes = dg.data_diagnostico.substring(0, 7); // yyyy-MM
      const current = taxaPorMesAtual.get(mes) ?? { total: 0, prenhes: 0 };
      current.total += 1;
      if (dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')) {
        current.prenhes += 1;
      }
      taxaPorMesAtual.set(mes, current);
    });

    // Calcular taxa por mês (anterior)
    const taxaPorMesAnterior = new Map<string, { total: number; prenhes: number }>();
    dgsAnterior?.forEach(dg => {
      const mes = dg.data_diagnostico.substring(0, 7);
      const current = taxaPorMesAnterior.get(mes) ?? { total: 0, prenhes: 0 };
      current.total += 1;
      if (dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')) {
        current.prenhes += 1;
      }
      taxaPorMesAnterior.set(mes, current);
    });

    // Montar dados para o gráfico
    const tendencia: TendenciaMensal[] = mesesAtual.map((mesAtual, index) => {
      const mesKey = format(mesAtual, 'yyyy-MM');
      const mesAnterior = mesesAnterior[index];
      const mesAnteriorKey = mesAnterior ? format(mesAnterior, 'yyyy-MM') : null;

      const dadosAtual = taxaPorMesAtual.get(mesKey);
      const dadosAnterior = mesAnteriorKey ? taxaPorMesAnterior.get(mesAnteriorKey) : null;

      return {
        mes: mesKey,
        mesLabel: format(mesAtual, 'MMM', { locale: ptBR }).toUpperCase(),
        valorAtual: dadosAtual && dadosAtual.total > 0
          ? (dadosAtual.prenhes / dadosAtual.total) * 100
          : undefined,
        valorAnterior: dadosAnterior && dadosAnterior.total > 0
          ? (dadosAnterior.prenhes / dadosAnterior.total) * 100
          : undefined,
      };
    });

    return tendencia;
  }, []);

  // Carregar todos os dados
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar dados do período atual e anterior em paralelo
      const [
        prenhezAtual,
        prenhezAnterior,
        viradaAtual,
        viradaAnterior,
        tendencia,
        touros,
        fazendas,
        doadoras,
        veterinarios,
        tecnicos,
      ] = await Promise.all([
        fetchTaxaPrenhez(periodo.inicio, periodo.fim),
        fetchTaxaPrenhez(periodo.inicioAnterior, periodo.fimAnterior),
        fetchTaxaVirada(periodo.inicio, periodo.fim),
        fetchTaxaVirada(periodo.inicioAnterior, periodo.fimAnterior),
        fetchTendenciaPrenhez(periodo),
        fetchRankingTouros(periodo.inicio, periodo.fim),
        fetchRankingFazendas(periodo.inicio, periodo.fim),
        fetchRankingDoadoras(periodo.inicio, periodo.fim),
        fetchRankingResponsaveis(periodo.inicio, periodo.fim, 'veterinario_responsavel'),
        fetchRankingResponsaveis(periodo.inicio, periodo.fim, 'tecnico_responsavel'),
      ]);

      // Calcular deltas
      const calcDelta = (atual: number, anterior: number) => atual - anterior;
      const calcDeltaPercent = (atual: number, anterior: number) =>
        anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;

      const hasAnteriorPrenhez = prenhezAnterior.total > 0;
      const hasAnteriorVirada = viradaAnterior.oocitos > 0;

      setData({
        taxaPrenhez: {
          atual: prenhezAtual.taxa,
          anterior: hasAnteriorPrenhez ? prenhezAnterior.taxa : null,
          delta: hasAnteriorPrenhez ? calcDelta(prenhezAtual.taxa, prenhezAnterior.taxa) : null,
          deltaPercent: hasAnteriorPrenhez ? calcDeltaPercent(prenhezAtual.taxa, prenhezAnterior.taxa) : null,
          total: prenhezAtual.total,
          totalAnterior: hasAnteriorPrenhez ? prenhezAnterior.total : null,
        },
        taxaVirada: {
          atual: viradaAtual.taxa,
          anterior: hasAnteriorVirada ? viradaAnterior.taxa : null,
          delta: hasAnteriorVirada ? calcDelta(viradaAtual.taxa, viradaAnterior.taxa) : null,
          deltaPercent: hasAnteriorVirada ? calcDeltaPercent(viradaAtual.taxa, viradaAnterior.taxa) : null,
          total: viradaAtual.embrioes,
          totalAnterior: hasAnteriorVirada ? viradaAnterior.embrioes : null,
        },
        totalTEs: prenhezAtual.total, // TEs realizadas ~ DGs feitos
        totalDGs: prenhezAtual.total,
        tendenciaPrenhez: tendencia,
        rankingTouros: touros,
        rankingFazendas: fazendas,
        rankingDoadoras: doadoras,
        rankingVeterinarios: veterinarios,
        rankingTecnicos: tecnicos,
      });
    } catch (err) {
      console.error('Erro ao carregar KPIs:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [
    periodo,
    fetchTaxaPrenhez,
    fetchTaxaVirada,
    fetchTendenciaPrenhez,
    fetchRankingTouros,
    fetchRankingFazendas,
    fetchRankingDoadoras,
    fetchRankingResponsaveis,
  ]);

  // Carregar dados quando período mudar
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ano atual e anterior para legendas
  const anoAtual = useMemo(() => periodo.inicio.getFullYear(), [periodo]);
  const anoAnterior = useMemo(() => periodo.inicioAnterior.getFullYear(), [periodo]);

  return {
    data,
    loading,
    error,
    refetch: loadData,
    anoAtual,
    anoAnterior,
    temDadosAnoAnterior: data.taxaPrenhez.anterior !== null,
  };
}

export default useKPIData;
