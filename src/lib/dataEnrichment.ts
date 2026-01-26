/**
 * Funções utilitárias para enriquecimento de dados
 * Centraliza lógica duplicada de busca e mapeamento de dados relacionados
 */

import { supabase } from './supabase';
import type { EmbriaoQuery, DoseComTouroQuery } from './types';

// ========================================
// Tipos para as funções utilitárias
// ========================================

export interface AcasalamentoQuery {
  id: string;
  aspiracao_doadora_id: string;
  dose_semen_id: string;
  lote_fiv_id?: string;
  quantidade_embrioes?: number;
}

export interface AspiracaoQuery {
  id: string;
  doadora_id: string;
}

export interface DoadoraQuery {
  id: string;
  registro: string;
  nome?: string;
}

export interface LoteFIVQuerySimples {
  id: string;
  data_abertura: string;
}

export interface DadosGenealogia {
  doadorasMap: Map<string, string>;  // acasalamento_id -> doadora_registro
  tourosMap: Map<string, string>;    // acasalamento_id -> touro_nome
}

// ========================================
// Função 1: Buscar dados de genealogia (doadora + touro)
// ========================================

/**
 * Busca dados de doadora e touro a partir de IDs de acasalamento
 * Retorna mapas: acasalamento_id -> doadora_registro e acasalamento_id -> touro_nome
 */
export async function buscarDadosGenealogia(
  acasalamentoIds: string[]
): Promise<DadosGenealogia> {
  const doadorasMap = new Map<string, string>();
  const tourosMap = new Map<string, string>();

  if (acasalamentoIds.length === 0) {
    return { doadorasMap, tourosMap };
  }

  // 1. Buscar acasalamentos
  const { data: acasalamentosData, error: acasalamentosError } = await supabase
    .from('lote_fiv_acasalamentos')
    .select('id, aspiracao_doadora_id, dose_semen_id')
    .in('id', acasalamentoIds);

  if (acasalamentosError || !acasalamentosData || acasalamentosData.length === 0) {
    return { doadorasMap, tourosMap };
  }

  // 2. Extrair IDs únicos de aspiração e dose
  const aspiracaoIds = [...new Set(
    acasalamentosData
      .map((a) => a.aspiracao_doadora_id)
      .filter(Boolean)
  )] as string[];

  const doseIds = [...new Set(
    acasalamentosData
      .map((a) => a.dose_semen_id)
      .filter(Boolean)
  )] as string[];

  // 3. Buscar aspirações e doses em paralelo
  const [aspiracoesResult, dosesResult] = await Promise.all([
    aspiracaoIds.length > 0
      ? supabase
          .from('aspiracoes_doadoras')
          .select('id, doadora_id')
          .in('id', aspiracaoIds)
      : Promise.resolve({ data: null, error: null }),
    doseIds.length > 0
      ? supabase
          .from('doses_semen')
          .select('id, touro_id, touro:touros(id, nome, registro, raca)')
          .in('id', doseIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const aspiracoesData = aspiracoesResult.data || [];
  const dosesData = (dosesResult.data || []) as DoseComTouroQuery[];

  // 4. Buscar doadoras se houver aspirações
  let doadorasData: DoadoraQuery[] = [];
  if (aspiracoesData.length > 0) {
    const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
    const { data } = await supabase
      .from('doadoras')
      .select('id, registro, nome')
      .in('id', doadoraIds);
    doadorasData = data || [];
  }

  // 5. Criar mapas intermediários
  const doadorasPorId = new Map(doadorasData.map((d) => [d.id, d.registro]));
  const aspiracoesPorId = new Map(aspiracoesData.map((a) => [a.id, a.doadora_id]));
  const dosesPorId = new Map(
    dosesData.map((d) => {
      const touro = Array.isArray(d.touro) ? d.touro[0] : d.touro;
      return [d.id, touro?.nome || 'Touro desconhecido'];
    })
  );

  // 6. Criar mapas finais por acasalamento_id
  acasalamentosData.forEach((ac) => {
    // Doadora
    const doadoraId = aspiracoesPorId.get(ac.aspiracao_doadora_id);
    if (doadoraId) {
      const registro = doadorasPorId.get(doadoraId);
      if (registro) {
        doadorasMap.set(ac.id, registro);
      }
    }

    // Touro
    const touroNome = dosesPorId.get(ac.dose_semen_id);
    if (touroNome) {
      tourosMap.set(ac.id, touroNome);
    }
  });

  return { doadorasMap, tourosMap };
}

// ========================================
// Função 2: Criar mapa de fazendas
// ========================================

/**
 * Cria um mapa de fazenda_id -> nome a partir de uma lista de IDs
 */
export async function criarMapaFazendas(
  fazendaIds: string[]
): Promise<Map<string, string>> {
  const fazendaMap = new Map<string, string>();

  if (fazendaIds.length === 0) {
    return fazendaMap;
  }

  const idsUnicos = [...new Set(fazendaIds.filter(Boolean))];

  const { data, error } = await supabase
    .from('fazendas')
    .select('id, nome')
    .in('id', idsUnicos);

  if (error || !data) {
    return fazendaMap;
  }

  data.forEach((f) => {
    fazendaMap.set(f.id, f.nome);
  });

  return fazendaMap;
}

// ========================================
// Função 3: Buscar acasalamentos com opção de agrupamento
// ========================================

export interface AcasalamentosResult {
  acasalamentosMap: Map<string, AcasalamentoQuery>;
  acasalamentosPorLote?: Map<string, AcasalamentoQuery[]>;
  aspiracaoIds: string[];
  doseIds: string[];
}

/**
 * Busca acasalamentos por IDs ou por lote_fiv_id
 */
export async function buscarAcasalamentos(
  ids: string[],
  opcoes?: {
    porLoteFivId?: boolean;
    incluirQuantidade?: boolean;
  }
): Promise<AcasalamentosResult> {
  const result: AcasalamentosResult = {
    acasalamentosMap: new Map(),
    aspiracaoIds: [],
    doseIds: [],
  };

  if (ids.length === 0) {
    return result;
  }

  const campos = opcoes?.incluirQuantidade
    ? 'id, lote_fiv_id, aspiracao_doadora_id, dose_semen_id, quantidade_embrioes'
    : 'id, lote_fiv_id, aspiracao_doadora_id, dose_semen_id';

  const query = supabase
    .from('lote_fiv_acasalamentos')
    .select(campos);

  const { data, error } = opcoes?.porLoteFivId
    ? await query.in('lote_fiv_id', ids)
    : await query.in('id', ids);

  if (error || !data) {
    return result;
  }

  // Criar mapa por ID
  data.forEach((ac) => {
    result.acasalamentosMap.set(ac.id, ac as AcasalamentoQuery);
  });

  // Se busca por lote_fiv_id, também agrupar
  if (opcoes?.porLoteFivId) {
    result.acasalamentosPorLote = new Map();
    data.forEach((ac) => {
      const loteId = ac.lote_fiv_id;
      if (loteId) {
        if (!result.acasalamentosPorLote!.has(loteId)) {
          result.acasalamentosPorLote!.set(loteId, []);
        }
        result.acasalamentosPorLote!.get(loteId)!.push(ac as AcasalamentoQuery);
      }
    });
  }

  // Extrair IDs únicos
  result.aspiracaoIds = [...new Set(data.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
  result.doseIds = [...new Set(data.map((a) => a.dose_semen_id).filter(Boolean))];

  return result;
}

// ========================================
// Função 4: Buscar lotes FIV
// ========================================

/**
 * Busca lotes FIV e retorna mapa de id -> lote
 */
export async function buscarLotesFIV(
  loteIds: string[]
): Promise<Map<string, LoteFIVQuerySimples>> {
  const lotesMap = new Map<string, LoteFIVQuerySimples>();

  if (loteIds.length === 0) {
    return lotesMap;
  }

  const { data, error } = await supabase
    .from('lotes_fiv')
    .select('id, data_abertura')
    .in('id', loteIds);

  if (error || !data) {
    return lotesMap;
  }

  data.forEach((l) => {
    lotesMap.set(l.id, l);
  });

  return lotesMap;
}

// ========================================
// Função 5: Calcular dias de gestação
// ========================================

/**
 * Calcula dias de gestação a partir da data de abertura do lote (D0)
 */
export function calcularDiasGestacao(dataAbertura: string): number {
  const d0 = new Date(dataAbertura);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
}

// ========================================
// Função 6: Extrair IDs de acasalamento de embriões
// ========================================

/**
 * Extrai IDs únicos de acasalamento de uma lista de embriões
 */
export function extrairAcasalamentoIds(
  embrioes: Array<{ lote_fiv_acasalamento_id?: string | null }>
): string[] {
  return [...new Set(
    embrioes
      .filter((e) => e.lote_fiv_acasalamento_id)
      .map((e) => e.lote_fiv_acasalamento_id)
  )] as string[];
}

/**
 * Extrai IDs únicos de lote FIV de uma lista de embriões
 */
export function extrairLoteIds(
  embrioes: Array<{ lote_fiv_id?: string | null }>
): string[] {
  return [...new Set(
    embrioes
      .filter((e) => e.lote_fiv_id)
      .map((e) => e.lote_fiv_id)
  )] as string[];
}
