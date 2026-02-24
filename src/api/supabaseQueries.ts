/**
 * Camada centralizada de queries Supabase
 * - Single source of truth para todas as queries
 * - Facilita caching com React Query
 * - Tipagem consistente
 */

import { supabase } from '@/lib/supabase';
import type { Fazenda, Touro, Doadora } from '@/lib/types';

// ============================================
// FAZENDAS
// ============================================

export interface FazendaBasica {
  id: string;
  nome: string;
  cliente_id?: string;
}

export async function fetchFazendas(): Promise<FazendaBasica[]> {
  const { data, error } = await supabase
    .from('fazendas')
    .select('id, nome, cliente_id')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchFazendaById(id: string): Promise<Fazenda | null> {
  const { data, error } = await supabase
    .from('fazendas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchFazendasByClienteId(clienteId: string): Promise<Fazenda[]> {
  const { data, error } = await supabase
    .from('fazendas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ============================================
// TOUROS
// ============================================

export async function fetchTouros(): Promise<Touro[]> {
  const { data, error } = await supabase
    .from('touros')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchTouroById(id: string): Promise<Touro | null> {
  const { data, error } = await supabase
    .from('touros')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// DOADORAS
// ============================================

export interface DoadoraComUltimaAspiracao extends Doadora {
  ultima_aspiracao_total_oocitos?: number;
  ultima_aspiracao_data?: string;
}

export async function fetchDoadorasByFazendaId(fazendaId: string): Promise<DoadoraComUltimaAspiracao[]> {
  const { data, error } = await supabase
    .from('doadoras')
    .select(`
      *,
      aspiracoes_doadoras(
        total_oocitos,
        data_aspiracao
      )
    `)
    .eq('fazenda_id', fazendaId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Processar para pegar última aspiração
  return (data || []).map((doadora) => {
    const aspiracoes = (doadora as Record<string, unknown>).aspiracoes_doadoras as { total_oocitos: number; data_aspiracao: string }[] || [];
    const ultimaAspiracao = aspiracoes.length > 0
      ? aspiracoes.sort((a, b) =>
        new Date(b.data_aspiracao).getTime() - new Date(a.data_aspiracao).getTime()
      )[0]
      : null;

    const { aspiracoes_doadoras, ...doadoraSemAspiracoes } = doadora;

    return {
      ...doadoraSemAspiracoes,
      ultima_aspiracao_total_oocitos: ultimaAspiracao?.total_oocitos,
      ultima_aspiracao_data: ultimaAspiracao?.data_aspiracao,
    };
  });
}

export async function fetchDoadoraById(id: string): Promise<Doadora | null> {
  const { data, error } = await supabase
    .from('doadoras')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// RECEPTORAS (via view)
// ============================================

export interface ReceptoraView {
  id: string; // Changed from receptora_id
  fazenda_atual_id: string; // Changed from fazenda_id_atual
  fazenda_nome_atual?: string;
  cliente_id?: string;
}

export interface ReceptoraComStatus {
  id: string;
  identificacao: string;
  nome?: string;
  raca?: string;
  status_reprodutivo?: string;
  status_calculado: string;
  fazenda_nome_atual?: string;
  numero_gestacoes?: number;
  [key: string]: unknown;
}

export async function fetchReceptorasViewByFazenda(fazendaId: string): Promise<ReceptoraView[]> {
  const { data, error } = await supabase
    .from('receptoras')
    .select('id, fazendas!fazenda_atual_id(id, nome)')
    .eq('fazenda_atual_id', fazendaId);

  if (error) throw error;

  return (data || []).map(r => {
    const fazenda = Array.isArray(r.fazendas) ? r.fazendas[0] : r.fazendas;
    return {
      id: r.id,
      fazenda_atual_id: fazenda?.id,
      fazenda_nome_atual: fazenda?.nome
    };
  }) as ReceptoraView[];
}

export async function fetchReceptorasByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('receptoras')
    .select('*')
    .in('id', ids)
    .order('identificacao', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Busca receptoras completas de uma fazenda com status calculado
 * - Usa view para pegar IDs das receptoras atuais
 * - Busca dados completos + diagnósticos em uma query
 */
export async function fetchReceptorasComStatusByFazenda(fazendaId: string): Promise<ReceptoraComStatus[]> {
  // 1. Busca IDs e nomes
  const { data: viewData, error: viewError } = await supabase
    .from('receptoras')
    .select('id, fazendas!fazenda_atual_id(nome)')
    .eq('fazenda_atual_id', fazendaId);

  if (viewError) throw viewError;

  const receptoraIds = viewData?.map(v => v.id) || [];
  if (receptoraIds.length === 0) return [];

  // 2. Busca dados completos das receptoras
  const { data: receptorasData, error: receptorasError } = await supabase
    .from('receptoras')
    .select('*')
    .in('id', receptoraIds)
    .order('identificacao', { ascending: true });

  if (receptorasError) throw receptorasError;

  // Map fazenda_nome_atual
  const fazendaMap = new Map(viewData?.map(v => {
    const fazenda = Array.isArray(v.fazendas) ? v.fazendas[0] : v.fazendas;
    return [v.id, fazenda?.nome];
  }) || []);

  // Create receptoras with status
  const receptorasComStatus: ReceptoraComStatus[] = (receptorasData || []).map(r => ({
    ...r,
    fazenda_nome_atual: fazendaMap.get(r.id),
    status_calculado: r.status_reprodutivo || 'VAZIA',
  }));

  // 3. Busca número de gestações para receptoras prenhes
  const statusPrenhes = ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'];
  const receptorasPrenhes = receptorasComStatus.filter(r =>
    statusPrenhes.includes(r.status_calculado) || r.status_calculado.includes('PRENHE')
  );

  if (receptorasPrenhes.length > 0) {
    const prenhesIds = receptorasPrenhes.map(r => r.id);

    const { data: diagnosticosData, error: diagnosticosError } = await supabase
      .from('diagnosticos_gestacao')
      .select('receptora_id, numero_gestacoes')
      .in('receptora_id', prenhesIds)
      .in('resultado', ['PRENHE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'])
      .not('numero_gestacoes', 'is', null);

    if (!diagnosticosError && diagnosticosData) {
      const gestacoesMap = new Map<string, number>();

      diagnosticosData.forEach(dg => {
        if (dg.numero_gestacoes && dg.numero_gestacoes > 1) {
          const atual = gestacoesMap.get(dg.receptora_id) || 0;
          if (dg.numero_gestacoes > atual) {
            gestacoesMap.set(dg.receptora_id, dg.numero_gestacoes);
          }
        }
      });

      receptorasComStatus.forEach(r => {
        const numGestacoes = gestacoesMap.get(r.id);
        if (numGestacoes && numGestacoes > 1) {
          r.numero_gestacoes = numGestacoes;
        }
      });
    }
  }

  return receptorasComStatus;
}

// ============================================
// DOSES DE SEMEN
// ============================================

export interface DoseSemenComTouro {
  id: string;
  quantidade: number;
  tipo_semen?: string;
  cliente_id?: string;
  touro?: {
    id: string;
    nome?: string;
    registro?: string;
    raca?: string;
  };
}

export async function fetchDosesByClienteId(clienteId: string): Promise<DoseSemenComTouro[]> {
  const { data, error } = await supabase
    .from('doses_semen')
    .select(`*, touro:touros(id, nome, registro, raca)`)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================
// CLIENTES
// ============================================

export interface ClienteBasico {
  id: string;
  nome: string;
}

export async function fetchClientes(): Promise<ClienteBasico[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchClienteById(id: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}
