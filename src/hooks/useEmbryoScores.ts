/**
 * Hooks para buscar scores de embriões (EmbryoScore)
 *
 * Usa TanStack Query com polling condicional:
 * - Enquanto não tem score → refetch a cada 5s
 * - Quando score chega → para de pollar
 *
 * Também monitora status da fila de análise.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore, EmbryoAnalysisQueue } from '@/lib/types';

/**
 * Buscar score mais recente (is_current) de um embrião individual
 */
export function useEmbryoScore(embriaoId: string | undefined) {
  return useQuery<EmbryoScore | null>({
    queryKey: ['embryo-score', embriaoId],
    queryFn: async () => {
      if (!embriaoId) return null;
      const { data, error } = await supabase
        .from('embryo_scores')
        .select('*')
        .eq('embriao_id', embriaoId)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as EmbryoScore | null;
    },
    enabled: !!embriaoId,
    refetchInterval: (query) => {
      // Polling a cada 5s enquanto não tem score
      return query.state.data ? false : 5000;
    },
    staleTime: 30_000,
  });
}

/**
 * Buscar todos os scores de um acasalamento (batch — para listagem)
 */
export function useAcasalamentoScores(acasalamentoId: string | undefined) {
  return useQuery<EmbryoScore[]>({
    queryKey: ['acasalamento-scores', acasalamentoId],
    queryFn: async () => {
      if (!acasalamentoId) return [];

      // Buscar embriões do acasalamento
      const { data: embrioes } = await supabase
        .from('embrioes')
        .select('id')
        .eq('lote_fiv_acasalamento_id', acasalamentoId);

      if (!embrioes?.length) return [];

      const embriaoIds = embrioes.map(e => e.id);

      const { data, error } = await supabase
        .from('embryo_scores')
        .select('*')
        .in('embriao_id', embriaoIds)
        .eq('is_current', true)
        .order('embryo_score', { ascending: false });

      if (error) throw error;
      return (data || []) as EmbryoScore[];
    },
    enabled: !!acasalamentoId,
    staleTime: 30_000,
  });
}

/**
 * Buscar scores em batch para múltiplos embriões (otimizado).
 * Usa Realtime subscription para invalidar cache quando novos scores chegam,
 * com fallback para polling se Realtime não conectar.
 */
export function useEmbryoScoresBatch(embriaoIds: string[]) {
  const queryClient = useQueryClient();
  const realtimeConnected = useRef(false);

  // Realtime subscription para novos scores
  useEffect(() => {
    if (embriaoIds.length === 0) return;

    const channel = supabase
      .channel(`embryo-scores-batch-${embriaoIds.slice(0, 3).join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'embryo_scores',
        },
        (payload) => {
          const newScore = payload.new as { embriao_id?: string };
          if (newScore.embriao_id && embriaoIds.includes(newScore.embriao_id)) {
            queryClient.invalidateQueries({
              queryKey: ['embryo-scores-batch', embriaoIds.sort().join(',')],
            });
          }
        }
      )
      .subscribe((status) => {
        realtimeConnected.current = status === 'SUBSCRIBED';
      });

    return () => {
      supabase.removeChannel(channel);
      realtimeConnected.current = false;
    };
  }, [embriaoIds.sort().join(','), queryClient]);

  return useQuery<Record<string, EmbryoScore>>({
    queryKey: ['embryo-scores-batch', embriaoIds.sort().join(',')],
    queryFn: async () => {
      if (!embriaoIds.length) return {};

      const { data, error } = await supabase
        .from('embryo_scores')
        .select('*')
        .in('embriao_id', embriaoIds)
        .eq('is_current', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por embriao_id (pegar só o mais recente de cada)
      const map: Record<string, EmbryoScore> = {};
      for (const score of (data || [])) {
        if (!map[score.embriao_id]) {
          map[score.embriao_id] = score as EmbryoScore;
        }
      }
      return map;
    },
    enabled: embriaoIds.length > 0,
    refetchInterval: (query) => {
      // Polling enquanto nem todos os embriões têm score
      const scoresMap = query.state.data;
      if (!scoresMap) return 5000;
      const allHaveScores = embriaoIds.every(id => scoresMap[id]);
      return allHaveScores ? false : 5000;
    },
    staleTime: 5_000,
  });
}

/**
 * Monitorar status da fila de análise de um acasalamento
 */
export function useEmbryoAnalysisStatus(acasalamentoId: string | undefined) {
  return useQuery<EmbryoAnalysisQueue | null>({
    queryKey: ['embryo-analysis-status', acasalamentoId],
    queryFn: async () => {
      if (!acasalamentoId) return null;
      const { data, error } = await supabase
        .from('embryo_analysis_queue')
        .select('*')
        .eq('lote_fiv_acasalamento_id', acasalamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as EmbryoAnalysisQueue | null;
    },
    enabled: !!acasalamentoId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'completed' || status === 'failed') ? false : 3000;
    },
    staleTime: 10_000,
  });
}

/**
 * Monitorar status da fila de análise em batch (por lote_fiv_acasalamento_id).
 * Retorna um mapa { acasalamento_id → EmbryoAnalysisQueue } com o job mais recente de cada.
 * Não depende de queue_id do embrião (que pode estar desatualizado no cache).
 */
export function useEmbryoAnalysisStatusBatch(acasalamentoIds: string[]) {
  const validIds = [...new Set(acasalamentoIds.filter(Boolean))];
  const cacheKey = validIds.sort().join(',');

  return useQuery<Record<string, EmbryoAnalysisQueue>>({
    queryKey: ['embryo-analysis-status-batch', cacheKey],
    queryFn: async () => {
      if (!validIds.length) return {};

      const { data, error } = await supabase
        .from('embryo_analysis_queue')
        .select('*')
        .in('lote_fiv_acasalamento_id', validIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por acasalamento_id — pegar apenas o mais recente de cada
      const map: Record<string, EmbryoAnalysisQueue> = {};
      for (const item of (data || [])) {
        if (!map[item.lote_fiv_acasalamento_id]) {
          map[item.lote_fiv_acasalamento_id] = item as EmbryoAnalysisQueue;
        }
      }
      return map;
    },
    enabled: validIds.length > 0,
    refetchInterval: (query) => {
      const statusMap = query.state.data;
      if (!statusMap) return 3000;
      const hasActive = Object.values(statusMap).some(
        (q) => q.status === 'pending' || q.status === 'processing'
      );
      return hasActive ? 3000 : false;
    },
    staleTime: 5_000,
  });
}

/**
 * Dados estruturados da fila global de análise.
 * Polling leve (10s) para barra de status no layout.
 */
export interface GlobalAnalysisQueueData {
  pending: number;
  processing: number;
  total: number;
  oldestStartedAt: string | null;
  newestExpectedCount: number | null;
}

export function useGlobalAnalysisQueue() {
  return useQuery<GlobalAnalysisQueueData>({
    queryKey: ['global-analysis-queue-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embryo_analysis_queue')
        .select('id, status, started_at, expected_count')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error || !data) return { pending: 0, processing: 0, total: 0, oldestStartedAt: null, newestExpectedCount: null };

      let pending = 0;
      let processing = 0;
      let oldestStartedAt: string | null = null;
      let newestExpectedCount: number | null = null;

      for (const job of data) {
        if (job.status === 'pending') pending++;
        if (job.status === 'processing') {
          processing++;
          if (job.started_at && (!oldestStartedAt || job.started_at < oldestStartedAt)) {
            oldestStartedAt = job.started_at;
          }
          if (job.expected_count != null) {
            newestExpectedCount = job.expected_count;
          }
        }
      }

      return { pending, processing, total: pending + processing, oldestStartedAt, newestExpectedCount };
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

/**
 * Mutation para reanalisar um job falho (retry).
 * Reseta status para 'pending' e invoca a Edge Function.
 */
export function useRetryAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueId: string) => {
      // Ler retry_count atual antes de incrementar
      const { data: current } = await supabase
        .from('embryo_analysis_queue')
        .select('retry_count')
        .eq('id', queueId)
        .single();

      const { error: updateError } = await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'pending',
          retry_count: (current?.retry_count || 0) + 1,
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq('id', queueId);

      if (updateError) throw updateError;

      // Invocar a Edge Function para processar
      const { data, error: fnError } = await supabase.functions.invoke('embryo-analyze', {
        body: { queue_id: queueId },
      });

      if (fnError) {
        console.error('EmbryoScore: Erro na função embryo-analyze (Retry):', fnError);
        throw fnError;
      }

      console.log('EmbryoScore: Retry iniciado:', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status-batch'] });
      queryClient.invalidateQueries({ queryKey: ['global-analysis-queue-count'] });
    },
  });
}

/**
 * Mutation para cancelar um job pendente/processando.
 * Marca como 'failed' com mensagem de cancelamento.
 */
export function useCancelAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'failed',
          error_message: 'Cancelado pelo usuário',
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status-batch'] });
      queryClient.invalidateQueries({ queryKey: ['global-analysis-queue-count'] });
    },
  });
}

/**
 * Mutation para cancelar TODOS os jobs pendentes/processando na fila.
 */
export function useCancelAllAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'failed',
          error_message: 'Cancelado pelo usuário',
          completed_at: new Date().toISOString(),
        })
        .in('status', ['pending', 'processing']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status-batch'] });
      queryClient.invalidateQueries({ queryKey: ['global-analysis-queue-count'] });
    },
  });
}
