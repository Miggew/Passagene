/**
 * Hook para gerenciar dados e filtros da lista de protocolos
 * - Carregamento de protocolos com filtros
 * - Persistência de filtros no localStorage
 * - Paginação
 * - Filtragem de protocolos "zumbis" (sem receptoras)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Fazenda } from '@/lib/types';
import { handleError } from '@/lib/error-handler';
import { todayISO as getTodayDateString, addDays } from '@/lib/dateUtils';

export interface ProtocoloWithFazenda extends ProtocoloSincronizacao {
  fazenda_nome: string;
  receptoras_count: number;
}

export type FiltroDataTipo = 'data_inicio' | 'passo2_data';

export interface ProtocolosFiltros {
  filtroStatus: string;
  fazendaFilter: string;
  filtroDataInicio: string;
  filtroDataFim: string;
  filtroDataTipo: FiltroDataTipo;
}

const PROTOCOLOS_FILTROS_KEY = 'protocolos_filtros';
const PROTOCOLOS_PAGE_SIZE = 50;

interface ProtocolosFiltrosPersistidos extends Partial<ProtocolosFiltros> {
  protocolosPage?: number;
}

const carregarFiltrosPersistidos = (): ProtocolosFiltrosPersistidos => {
  try {
    const raw = localStorage.getItem(PROTOCOLOS_FILTROS_KEY);
    return raw ? (JSON.parse(raw) as ProtocolosFiltrosPersistidos) : {};
  } catch {
    return {};
  }
};

export interface UseProtocolosDataReturn {
  // Loading states
  loading: boolean;
  loadingProtocolos: boolean;

  // Data
  protocolos: ProtocoloWithFazenda[];
  fazendas: Fazenda[];
  protocolosTotalCount: number;
  statsAproveitamento: { finalizadas: number; utilizadas: number; sincronizadas: number };

  // Filters
  filtroStatus: string;
  setFiltroStatus: (status: string) => void;
  fazendaFilter: string;
  setFazendaFilter: (fazenda: string) => void;
  filtroDataInicio: string;
  setFiltroDataInicio: (data: string) => void;
  filtroDataFim: string;
  setFiltroDataFim: (data: string) => void;
  filtroDataTipo: FiltroDataTipo;
  setFiltroDataTipo: (tipo: FiltroDataTipo) => void;

  // Pagination
  protocolosPage: number;
  setProtocolosPage: (page: number) => void;
  pageSize: number;

  // Actions
  loadData: () => Promise<void>;
  loadProtocolos: (pageOverride?: number, filters?: Partial<ProtocolosFiltros>) => Promise<void>;
  limparFiltros: () => void;
  aplicarAtalhoData: (dias: number) => void;
}

export function useProtocolosData(): UseProtocolosDataReturn {
  const filtrosPersistidos = carregarFiltrosPersistidos();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingProtocolos, setLoadingProtocolos] = useState(false);

  // Data
  const [protocolos, setProtocolos] = useState<ProtocoloWithFazenda[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [protocolosTotalCount, setProtocolosTotalCount] = useState(0);
  const [statsAproveitamento, setStatsAproveitamento] = useState({ finalizadas: 0, utilizadas: 0, sincronizadas: 0 });

  // Filters
  const [filtroStatus, setFiltroStatus] = useState<string>(filtrosPersistidos.filtroStatus || 'all');
  const [fazendaFilter, setFazendaFilter] = useState(filtrosPersistidos.fazendaFilter ?? '');
  const [filtroDataInicio, setFiltroDataInicio] = useState(filtrosPersistidos.filtroDataInicio ?? '');
  const [filtroDataFim, setFiltroDataFim] = useState(filtrosPersistidos.filtroDataFim ?? '');
  const [filtroDataTipo, setFiltroDataTipo] = useState<FiltroDataTipo>(filtrosPersistidos.filtroDataTipo ?? 'data_inicio');

  // Pagination
  const [protocolosPage, setProtocolosPage] = useState(filtrosPersistidos.protocolosPage ?? 1);

  // Persist filters to localStorage
  useEffect(() => {
    const payload: ProtocolosFiltrosPersistidos = {
      filtroStatus,
      fazendaFilter,
      filtroDataInicio,
      filtroDataFim,
      filtroDataTipo,
      protocolosPage,
    };
    localStorage.setItem(PROTOCOLOS_FILTROS_KEY, JSON.stringify(payload));
  }, [filtroStatus, fazendaFilter, filtroDataInicio, filtroDataFim, filtroDataTipo, protocolosPage]);

  // Load fazendas
  const loadFazendas = useCallback(async () => {
    const { data, error } = await supabase
      .from('fazendas')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    setFazendas(data || []);
  }, []);

  // Load protocolos with filters and zombie filtering
  const loadProtocolos = useCallback(async (
    pageOverride?: number,
    filters?: Partial<ProtocolosFiltros>
  ) => {
    try {
      setLoadingProtocolos(true);

      // Use provided filters or current state
      const fazenda = filters?.fazendaFilter !== undefined ? filters.fazendaFilter : fazendaFilter;
      const dataInicio = filters?.filtroDataInicio !== undefined ? filters.filtroDataInicio : filtroDataInicio;
      const dataFim = filters?.filtroDataFim !== undefined ? filters.filtroDataFim : filtroDataFim;
      const status = filters?.filtroStatus !== undefined ? filters.filtroStatus : filtroStatus;
      const dataTipo = filters?.filtroDataTipo !== undefined ? filters.filtroDataTipo : filtroDataTipo;

      const currentPage = pageOverride !== undefined ? pageOverride : protocolosPage;

      // Query base
      const from = (currentPage - 1) * PROTOCOLOS_PAGE_SIZE;
      const to = from + (PROTOCOLOS_PAGE_SIZE * 2) - 1; // Fetch more to compensate for zombie filtering

      let query = supabase
        .from('protocolos_sincronizacao')
        .select('*', { count: 'exact' });

      // Apply filters
      if (fazenda && fazenda !== 'all') {
        query = query.eq('fazenda_id', fazenda);
      }

      // Date filter - use selected date field
      const campoData = dataTipo === 'passo2_data' ? 'passo2_data' : 'data_inicio';
      if (dataInicio) {
        query = query.gte(campoData, dataInicio);
      }

      if (dataFim) {
        query = query.lte(campoData, dataFim);
      }

      // Status filter
      if (status === 'aguardando_2_passo') {
        query = query.eq('status', 'PASSO1_FECHADO');
      } else if (status === 'sincronizado') {
        query = query.eq('status', 'SINCRONIZADO');
      } else if (status === 'fechado') {
        query = query.in('status', ['FECHADO', 'EM_TE']);
      }

      query = query.order('data_inicio', { ascending: false }).range(from, to);

      const { data: protocolosData, error, count } = await query;

      if (error) throw error;

      // Optimization: Fetch all data at once instead of individual queries
      const protocolosIds = (protocolosData || []).map(p => p.id);
      const fazendaIds = [...new Set((protocolosData || []).map(p => p.fazenda_id))];

      // Fetch receptora counts and status for all protocols at once
      const { data: receptorasData } = await supabase
        .from('protocolo_receptoras')
        .select('protocolo_id, status')
        .in('protocolo_id', protocolosIds);

      // Group counts by protocolo_id
      const contagemPorProtocolo = (receptorasData || []).reduce((acc, pr) => {
        acc[pr.protocolo_id] = (acc[pr.protocolo_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate stats for aproveitamento
      // Finalizadas = APTA + INAPTA + UTILIZADA (todas que terminaram o protocolo)
      // Utilizadas = UTILIZADA (receberam embrião)
      // Sincronizadas = APTA (aptas para receber embrião mas ainda não receberam)
      const statsReceptoras = (receptorasData || []).reduce((acc, pr) => {
        if (pr.status === 'APTA' || pr.status === 'INAPTA' || pr.status === 'UTILIZADA') {
          acc.finalizadas++;
        }
        if (pr.status === 'UTILIZADA') {
          acc.utilizadas++;
        }
        if (pr.status === 'APTA') {
          acc.sincronizadas++;
        }
        return acc;
      }, { finalizadas: 0, utilizadas: 0, sincronizadas: 0 });

      // Fetch fazenda names at once
      const { data: fazendasData } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds);

      // Create fazenda_id -> nome map
      const fazendasMap = (fazendasData || []).reduce((acc, fazenda) => {
        acc[fazenda.id] = fazenda.nome;
        return acc;
      }, {} as Record<string, string>);

      // Process protocols: filter zombies and add data
      const protocolosComContagem = (protocolosData || [])
        .map((protocolo) => {
          const receptorasCount = contagemPorProtocolo[protocolo.id] || 0;

          // Skip if no receptoras (zombie)
          if (receptorasCount === 0) {
            return null;
          }

          return {
            ...protocolo,
            fazenda_nome: fazendasMap[protocolo.fazenda_id] || 'N/A',
            receptoras_count: receptorasCount,
          };
        })
        .filter((p): p is ProtocoloWithFazenda => p !== null);

      // Limit to page size
      const protocolosValidos = protocolosComContagem.slice(0, PROTOCOLOS_PAGE_SIZE);

      setProtocolos(protocolosValidos);
      setProtocolosTotalCount(count || 0);
      setStatsAproveitamento(statsReceptoras);
    } catch (error) {
      handleError(error, 'Erro ao carregar protocolos');
      setProtocolos([]);
      setStatsAproveitamento({ finalizadas: 0, utilizadas: 0, sincronizadas: 0 });
    } finally {
      setLoadingProtocolos(false);
    }
  }, [fazendaFilter, filtroDataInicio, filtroDataFim, filtroDataTipo, filtroStatus, protocolosPage]);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadFazendas();
      await loadProtocolos();
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [loadFazendas, loadProtocolos]);

  // Clear filters
  const limparFiltros = useCallback(() => {
    setFazendaFilter('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroDataTipo('data_inicio');
    setFiltroStatus('all');
    setProtocolosPage(1);
  }, []);

  // Apply date shortcut
  const aplicarAtalhoData = useCallback((dias: number) => {
    const hoje = getTodayDateString();
    setFiltroDataFim(hoje);
    setFiltroDataInicio(addDays(hoje, -dias));
  }, []);

  return {
    // Loading states
    loading,
    loadingProtocolos,

    // Data
    protocolos,
    fazendas,
    protocolosTotalCount,
    statsAproveitamento,

    // Filters
    filtroStatus,
    setFiltroStatus,
    fazendaFilter,
    setFazendaFilter,
    filtroDataInicio,
    setFiltroDataInicio,
    filtroDataFim,
    setFiltroDataFim,
    filtroDataTipo,
    setFiltroDataTipo,

    // Pagination
    protocolosPage,
    setProtocolosPage,
    pageSize: PROTOCOLOS_PAGE_SIZE,

    // Actions
    loadData,
    loadProtocolos,
    limparFiltros,
    aplicarAtalhoData,
  };
}

export default useProtocolosData;
