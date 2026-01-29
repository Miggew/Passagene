/**
 * Hook para gerenciar carregamento de dados e filtros de embriões
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Embriao, Fazenda, Cliente } from '@/lib/types';
import { handleError } from '@/lib/error-handler';
import { useFazendas, useClientes } from '@/api';
import { todayISO, diffDays } from '@/lib/dateUtils';

export interface EmbrioCompleto extends Embriao {
  doadora_registro?: string;
  touro_nome?: string;
  fazenda_destino_nome?: string;
  data_aspiracao?: string;
  pacote_aspiracao_id?: string;
}

export interface PacoteAspiracaoInfo {
  id: string;
  data_aspiracao: string;
  fazenda_nome?: string;
  quantidade_doadoras: number;
  horario_inicio?: string;
  veterinario_responsavel?: string;
  total_oocitos?: number;
}

export interface PacoteEmbrioes {
  id: string;
  lote_fiv_id: string;
  data_despacho: string;
  data_fecundacao?: string;
  fazendas_destino_ids: string[];
  fazendas_destino_nomes: string[];
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
  sem_classificacao: number;
  classificados: {
    BE: number;
    BN: number;
    BX: number;
    BL: number;
    BI: number;
  };
  todos_classificados?: boolean;
  disponivel_para_transferencia?: boolean;
}

const EMBRIOES_FILTROS_KEY = 'embrioes_filtros';
const PAGE_SIZE = 20;

type EmbrioesFiltrosPersistidos = {
  selectedFazendaDestinoId?: string;
  paginasPacotes?: Record<string, number>;
};

const carregarFiltrosEmbrioes = (): EmbrioesFiltrosPersistidos => {
  try {
    const raw = localStorage.getItem(EMBRIOES_FILTROS_KEY);
    return raw ? (JSON.parse(raw) as EmbrioesFiltrosPersistidos) : {};
  } catch {
    return {};
  }
};

// Calcular dia do embrião (usando dateUtils)
export const calcularDiaEmbriao = (dataFecundacao: string | undefined): number | null => {
  if (!dataFecundacao) return null;
  return diffDays(dataFecundacao, todayISO());
};

export interface UseEmbrioesDataReturn {
  // Data
  embrioes: EmbrioCompleto[];
  pacotes: PacoteEmbrioes[];
  fazendas: Fazenda[];
  clientes: Cliente[];

  // Loading
  loading: boolean;

  // Filter state
  selectedFazendaDestinoId: string;
  setSelectedFazendaDestinoId: (id: string) => void;

  // Pagination
  paginasPacotes: Record<string, number>;
  setPaginasPacotes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  pageSize: number;

  // Actions
  loadData: () => Promise<void>;
  loadFazendas: () => Promise<void>;
  loadClientes: () => Promise<void>;
  reloadData: () => Promise<void>;

  // Utilities
  getClassificacaoAtual: (embriao: EmbrioCompleto) => string;
  getResumoPacote: (pacote: PacoteEmbrioes) => {
    semClassificacao: number;
    classificados: { BE: number; BN: number; BX: number; BL: number; BI: number };
    total: number;
    todosClassificados: boolean;
  };
  classificacoesPendentes: Record<string, string>;
  setClassificacoesPendentes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useEmbrioesData(): UseEmbrioesDataReturn {
  // Load persisted filters
  const filtrosPersistidos = useMemo(() => carregarFiltrosEmbrioes(), []);

  // Data state
  const [embrioes, setEmbrioes] = useState<EmbrioCompleto[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [loading, setLoading] = useState(false);

  // React Query hooks for fazendas and clientes
  const { data: fazendas = [], refetch: refetchFazendas } = useFazendas();
  const { data: clientes = [], refetch: refetchClientes } = useClientes();

  // Filter state
  const [selectedFazendaDestinoId, setSelectedFazendaDestinoId] = useState<string>(
    filtrosPersistidos.selectedFazendaDestinoId ?? ''
  );

  // Pagination
  const [paginasPacotes, setPaginasPacotes] = useState<Record<string, number>>(
    filtrosPersistidos.paginasPacotes ?? {}
  );

  // Pending classifications
  const [classificacoesPendentes, setClassificacoesPendentes] = useState<Record<string, string>>({});

  // Persist filters
  useEffect(() => {
    const payload: EmbrioesFiltrosPersistidos = {
      selectedFazendaDestinoId,
      paginasPacotes,
    };
    localStorage.setItem(EMBRIOES_FILTROS_KEY, JSON.stringify(payload));
  }, [selectedFazendaDestinoId, paginasPacotes]);

  // Adjust pagination when pacotes change
  useEffect(() => {
    setPaginasPacotes((prev) => {
      let changed = false;
      const next = { ...prev };
      pacotes.forEach((pacote) => {
        const totalPaginas = Math.max(1, Math.ceil(pacote.embrioes.length / PAGE_SIZE));
        if (!next[pacote.id]) {
          next[pacote.id] = 1;
          changed = true;
          return;
        }
        if (next[pacote.id] > totalPaginas) {
          next[pacote.id] = totalPaginas;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pacotes]);

  // Get current classification
  const getClassificacaoAtual = useCallback((embriao: EmbrioCompleto) => {
    const pendente = classificacoesPendentes[embriao.id];
    return (pendente ?? embriao.classificacao ?? '').trim();
  }, [classificacoesPendentes]);

  // Get pacote summary
  const getResumoPacote = useCallback((pacote: PacoteEmbrioes) => {
    const classificados = { BE: 0, BN: 0, BX: 0, BL: 0, BI: 0 };
    let semClassificacao = 0;
    pacote.embrioes.forEach((embriao) => {
      const classificacao = getClassificacaoAtual(embriao).toUpperCase();
      if (!classificacao) {
        semClassificacao += 1;
        return;
      }
      if (classificacao === 'BE') classificados.BE += 1;
      else if (classificacao === 'BN') classificados.BN += 1;
      else if (classificacao === 'BX') classificados.BX += 1;
      else if (classificacao === 'BL') classificados.BL += 1;
      else if (classificacao === 'BI') classificados.BI += 1;
    });
    return {
      semClassificacao,
      classificados,
      total: pacote.total,
      todosClassificados: pacote.total > 0 && semClassificacao === 0,
    };
  }, [getClassificacaoAtual]);

  // Load fazendas - using React Query (backward compatibility)
  const loadFazendas = useCallback(async () => {
    await refetchFazendas();
  }, [refetchFazendas]);

  // Load clientes - using React Query (backward compatibility)
  const loadClientes = useCallback(async () => {
    await refetchClientes();
  }, [refetchClientes]);

  // Main data loading
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Phase 1: Initial embryo query
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .in('status_atual', ['FRESCO', 'CONGELADO'])
        .is('cliente_id', null)
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

      if (!embrioesData || embrioesData.length === 0) {
        setEmbrioes([]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      // Collect IDs
      const acasalamentoIds = [...new Set(
        embrioesData.filter((e) => e.lote_fiv_acasalamento_id).map((e) => e.lote_fiv_acasalamento_id)
      )] as string[];
      const loteFivIds = [...new Set(
        embrioesData.filter((e) => e.lote_fiv_id).map((e) => e.lote_fiv_id)
      )] as string[];
      const fazendaDestinoIdsEmbrioes = [...new Set(
        embrioesData.filter((e) => e.fazenda_destino_id).map((e) => e.fazenda_destino_id)
      )] as string[];

      if (acasalamentoIds.length === 0) {
        setEmbrioes(embrioesData as EmbrioCompleto[]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      // Phase 2: Parallel queries
      const [acasalamentosResult, lotesFivResult] = await Promise.all([
        supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds),
        loteFivIds.length > 0
          ? supabase.from('lotes_fiv').select('id, pacote_aspiracao_id, data_fecundacao, disponivel_para_transferencia').in('id', loteFivIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (acasalamentosResult.error) throw acasalamentosResult.error;
      const acasalamentosData = acasalamentosResult.data || [];
      const lotesFivData = lotesFivResult.data || [];

      const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id))];
      const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id))];
      const pacoteIds = [...new Set(lotesFivData.map((l) => l.pacote_aspiracao_id).filter(Boolean))] as string[];

      const pacoteParaLoteMap = new Map<string, string>();
      const dataFecundacaoMap = new Map<string, string>();
      const disponivelTransferenciaMap = new Map<string, boolean>();
      lotesFivData.forEach(lote => {
        if (lote.pacote_aspiracao_id) {
          pacoteParaLoteMap.set(lote.id, lote.pacote_aspiracao_id);
        }
        if (lote.data_fecundacao) {
          dataFecundacaoMap.set(lote.id, lote.data_fecundacao);
        }
        disponivelTransferenciaMap.set(lote.id, lote.disponivel_para_transferencia === true);
      });

      // Phase 3: More parallel queries
      const [aspiracoesResult, dosesResult, pacotesResult] = await Promise.all([
        aspiracaoIds.length > 0
          ? supabase.from('aspiracoes_doadoras').select('id, doadora_id, pacote_aspiracao_id').in('id', aspiracaoIds)
          : Promise.resolve({ data: null, error: null }),
        doseIds.length > 0
          ? supabase.from('doses_semen').select('id, touro_id, touro:touros(id, nome, registro, raca)').in('id', doseIds)
          : Promise.resolve({ data: null, error: null }),
        pacoteIds.length > 0
          ? supabase.from('pacotes_aspiracao').select('id, data_aspiracao, fazenda_id, fazenda_destino_id, horario_inicio, veterinario_responsavel, total_oocitos').in('id', pacoteIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (aspiracoesResult.error) throw aspiracoesResult.error;
      if (dosesResult.error) throw dosesResult.error;

      const aspiracoesData = aspiracoesResult.data || [];
      const dosesData = dosesResult.data || [];
      const pacotesData = pacotesResult.data || [];

      const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
      const todasFazendaIds = new Set<string>(fazendaDestinoIdsEmbrioes);
      pacotesData.forEach(p => {
        if (p.fazenda_id) todasFazendaIds.add(p.fazenda_id);
        if (p.fazenda_destino_id) todasFazendaIds.add(p.fazenda_destino_id);
      });

      // Phase 4: Final parallel queries
      const [doadorasResult, fazendasResult, fazendasDestinoResult] = await Promise.all([
        doadoraIds.length > 0
          ? supabase.from('doadoras').select('id, registro').in('id', doadoraIds)
          : Promise.resolve({ data: null, error: null }),
        todasFazendaIds.size > 0
          ? supabase.from('fazendas').select('id, nome').in('id', Array.from(todasFazendaIds))
          : Promise.resolve({ data: null, error: null }),
        pacoteIds.length > 0
          ? supabase.from('pacotes_aspiracao_fazendas_destino').select('pacote_aspiracao_id, fazenda_destino_id').in('pacote_aspiracao_id', pacoteIds)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (doadorasResult.error) throw doadorasResult.error;

      const doadorasData = doadorasResult.data || [];
      const fazendasData = fazendasResult.data || [];
      const fazendasDestinoData = fazendasDestinoResult.data || [];

      // Build maps
      const fazendasDestinoMap = new Map(fazendasData.map((f) => [f.id, f.nome]));
      const fazendasDestinoPorPacoteMap = new Map<string, string[]>();
      fazendasDestinoData.forEach(item => {
        const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
        if (!atual.includes(item.fazenda_destino_id)) {
          atual.push(item.fazenda_destino_id);
        }
        fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
      });

      pacotesData.forEach(pacote => {
        if (pacote.fazenda_destino_id) {
          const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
          if (!atual.includes(pacote.fazenda_destino_id)) {
            atual.push(pacote.fazenda_destino_id);
          }
          fazendasDestinoPorPacoteMap.set(pacote.id, atual);
        }
      });

      const quantidadePorPacote = new Map<string, number>();
      aspiracoesData.forEach((a) => {
        if (a.pacote_aspiracao_id) {
          quantidadePorPacote.set(
            a.pacote_aspiracao_id,
            (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
          );
        }
      });

      const pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      pacotesData.forEach(pacote => {
        pacotesAspiracaoMap.set(pacote.id, {
          id: pacote.id,
          data_aspiracao: pacote.data_aspiracao,
          fazenda_nome: fazendasDestinoMap.get(pacote.fazenda_id),
          quantidade_doadoras: quantidadePorPacote.get(pacote.id) || 0,
          horario_inicio: pacote.horario_inicio,
          veterinario_responsavel: pacote.veterinario_responsavel,
          total_oocitos: pacote.total_oocitos,
        });
      });

      const aspiracoesMap = new Map(aspiracoesData.map((a) => [a.id, a]));
      const doadorasMap = new Map(doadorasData.map((d) => [d.id, d]));
      const dosesMap = new Map(dosesData.map((d) => [d.id, d]));
      const acasalamentosMap = new Map(acasalamentosData.map((a) => [a.id, a]));

      // Build complete embryos
      const embrioesCompletos: EmbrioCompleto[] = embrioesData.map((embriao) => {
        const acasalamento = embriao.lote_fiv_acasalamento_id
          ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
          : undefined;
        const aspiracao = acasalamento
          ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
          : undefined;
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;
        const pacoteId = embriao.lote_fiv_id ? pacoteParaLoteMap.get(embriao.lote_fiv_id) : undefined;
        const pacoteInfo = pacoteId ? pacotesAspiracaoMap.get(pacoteId) : undefined;

        return {
          ...embriao,
          doadora_registro: doadora?.registro,
          touro_nome: (dose as { touro?: { nome?: string } })?.touro?.nome,
          fazenda_destino_nome: embriao.fazenda_destino_id
            ? fazendasDestinoMap.get(embriao.fazenda_destino_id)
            : undefined,
          data_aspiracao: pacoteInfo?.data_aspiracao,
          pacote_aspiracao_id: pacoteId,
        };
      });

      // Group into packages FIRST (before filtering)
      const pacotesMap = new Map<string, PacoteEmbrioes>();
      embrioesCompletos.forEach((embriao) => {
        if (!embriao.lote_fiv_id) return;
        const dataDespacho = embriao.created_at?.split('T')[0] || '';
        const pacoteKey = `${embriao.lote_fiv_id}_${dataDespacho}`;
        const pacoteId = embriao.lote_fiv_id ? pacoteParaLoteMap.get(embriao.lote_fiv_id) : undefined;
        const pacoteInfo = pacoteId ? pacotesAspiracaoMap.get(pacoteId) : undefined;
        const fazendasDestino = pacoteId ? (fazendasDestinoPorPacoteMap.get(pacoteId) || []) : [];
        const fazendasDestinoNomes = fazendasDestino.map(id => fazendasDestinoMap.get(id) || 'N/A');

        if (!pacotesMap.has(pacoteKey)) {
          pacotesMap.set(pacoteKey, {
            id: pacoteKey,
            lote_fiv_id: embriao.lote_fiv_id,
            data_despacho: dataDespacho,
            data_fecundacao: embriao.lote_fiv_id ? dataFecundacaoMap.get(embriao.lote_fiv_id) : undefined,
            fazendas_destino_ids: fazendasDestino,
            fazendas_destino_nomes: fazendasDestinoNomes,
            pacote_info: pacoteInfo || {
              id: pacoteId || '',
              data_aspiracao: '',
              quantidade_doadoras: 0,
            },
            embrioes: [],
            total: 0,
            frescos: 0,
            congelados: 0,
            sem_classificacao: 0,
            classificados: { BE: 0, BN: 0, BX: 0, BL: 0, BI: 0 },
          });
        }

        const pacote = pacotesMap.get(pacoteKey)!;
        pacote.embrioes.push(embriao);
        pacote.total++;
        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
        if (!embriao.classificacao) pacote.sem_classificacao++;
        else {
          const cls = embriao.classificacao.toUpperCase();
          if (cls === 'BE') pacote.classificados.BE++;
          else if (cls === 'BN') pacote.classificados.BN++;
          else if (cls === 'BX') pacote.classificados.BX++;
          else if (cls === 'BL') pacote.classificados.BL++;
          else if (cls === 'BI') pacote.classificados.BI++;
        }
      });

      // Filter packages by fazenda destino if selected
      const pacotesFiltrados = selectedFazendaDestinoId
        ? Array.from(pacotesMap.values()).filter((pacote) =>
            pacote.fazendas_destino_ids.includes(selectedFazendaDestinoId)
          )
        : Array.from(pacotesMap.values());

      // Sort packages
      const pacotesArray = pacotesFiltrados.sort((a, b) => {
        const dateA = new Date(a.data_despacho).getTime();
        const dateB = new Date(b.data_despacho).getTime();
        return dateB - dateA;
      });

      pacotesArray.forEach((pacote) => {
        pacote.todos_classificados = pacote.total > 0 && pacote.sem_classificacao === 0;
        // Usar o valor do banco de dados, não calcular
        pacote.disponivel_para_transferencia = disponivelTransferenciaMap.get(pacote.lote_fiv_id) === true;
      });

      // Set filtered embrioes based on filtered pacotes
      const pacoteKeysFiltrados = new Set(pacotesArray.map(p => p.id));
      const embriosFiltrados = embrioesCompletos.filter((e) => {
        if (!e.lote_fiv_id) return false;
        const dataDespacho = e.created_at?.split('T')[0] || '';
        const pacoteKey = `${e.lote_fiv_id}_${dataDespacho}`;
        return pacoteKeysFiltrados.has(pacoteKey);
      });

      setEmbrioes(embriosFiltrados);
      setPacotes(pacotesArray);
    } catch (error) {
      handleError(error, 'Erro ao carregar embriões');
    } finally {
      setLoading(false);
    }
  }, [selectedFazendaDestinoId]);

  // Reload data
  const reloadData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    // Data
    embrioes,
    pacotes,
    fazendas,
    clientes,

    // Loading
    loading,

    // Filter state
    selectedFazendaDestinoId,
    setSelectedFazendaDestinoId,

    // Pagination
    paginasPacotes,
    setPaginasPacotes,
    pageSize: PAGE_SIZE,

    // Actions
    loadData,
    loadFazendas,
    loadClientes,
    reloadData,

    // Utilities
    getClassificacaoAtual,
    getResumoPacote,
    classificacoesPendentes,
    setClassificacoesPendentes,
  };
}

export default useEmbrioesData;
