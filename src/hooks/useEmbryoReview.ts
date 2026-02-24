/**
 * Hooks para o painel de revisão do biólogo (EmbryoScore v2).
 *
 * useReviewData(queueId) — Busca dados completos para revisão
 * useSubmitClassification() — Salva classificação + adiciona ao atlas
 * useUndoClassification() — Desfaz classificação (5 min)
 * useAtlasStats() — Contagem de referências no atlas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore, EmbryoAnalysisQueue, ClassificacaoEmbriao } from '@/lib/types';

// ─── useReviewData ───

interface ReviewEmbryo {
  id: string;
  identificacao: string;
  score: EmbryoScore | null;
}

interface ReviewData {
  queue: EmbryoAnalysisQueue;
  embrioes: ReviewEmbryo[];
  plateFramePath: string | null;
}

export function useReviewData(queueId: string | null) {
  return useQuery<ReviewData | null>({
    queryKey: ['embryo-review', queueId],
    queryFn: async () => {
      if (!queueId) return null;

      // Fetch queue
      const { data: queue, error: queueErr } = await supabase
        .from('embryo_analysis_queue')
        .select('*')
        .eq('id', queueId)
        .single();

      if (queueErr || !queue) return null;

      // Fetch embryos linked to this queue
      const { data: embrioes } = await supabase
        .from('embrioes')
        .select('id, identificacao')
        .eq('queue_id', queueId)
        .order('identificacao', { ascending: true });

      if (!embrioes?.length) return null;

      // Fetch current scores
      const { data: scores } = await supabase
        .from('embryo_scores')
        .select('*')
        .in('embriao_id', embrioes.map(e => e.id))
        .eq('is_current', true);

      const scoreMap = new Map((scores || []).map(s => [s.embriao_id, s as EmbryoScore]));

      const reviewEmbrioes: ReviewEmbryo[] = embrioes.map(e => ({
        id: e.id,
        identificacao: e.identificacao || '',
        score: scoreMap.get(e.id) || null,
      }));

      return {
        queue: queue as EmbryoAnalysisQueue,
        embrioes: reviewEmbrioes,
        plateFramePath: (queue as EmbryoAnalysisQueue).plate_frame_path || null,
      };
    },
    enabled: !!queueId,
    staleTime: 10_000,
  });
}

// ─── useSubmitClassification ───

interface SubmitClassificationParams {
  scoreId: string;
  embriaoId: string;
  classification: ClassificacaoEmbriao;
  queueId: string;
}

export function useSubmitClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scoreId, embriaoId, classification, queueId }: SubmitClassificationParams) => {
      // 1. Fetch current AI classification to determine agreement
      const { data: currentScore } = await supabase
        .from('embryo_scores')
        .select('combined_classification, knn_classification, mlp_classification')
        .eq('id', scoreId)
        .single();

      const aiClass = currentScore?.combined_classification
        || currentScore?.knn_classification
        || currentScore?.mlp_classification
        || null;

      // 2. Update embryo_scores with biologist classification
      const { error: scoreErr } = await supabase
        .from('embryo_scores')
        .update({
          biologist_classification: classification,
          biologist_agreed: aiClass ? aiClass === classification : null,
        })
        .eq('id', scoreId);

      if (scoreErr) throw scoreErr;

      // 3. Fetch score data for atlas insertion
      const { data: score } = await supabase
        .from('embryo_scores')
        .select('embedding, kinetic_intensity, kinetic_harmony, kinetic_symmetry, kinetic_stability, kinetic_bg_noise, crop_image_path, motion_map_path, composite_path, knn_classification, knn_confidence')
        .eq('id', scoreId)
        .single();

      if (!score?.embedding) return;

      // 4. Fetch lote_fiv_id for the reference
      const { data: queue } = await supabase
        .from('embryo_analysis_queue')
        .select('lote_fiv_acasalamento_id')
        .eq('id', queueId)
        .single();

      let loteFivId: string | null = null;
      let acasalamentoId: string | null = null;
      if (queue?.lote_fiv_acasalamento_id) {
        acasalamentoId = queue.lote_fiv_acasalamento_id;
        const { data: acas } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('lote_fiv_id')
          .eq('id', queue.lote_fiv_acasalamento_id)
          .single();
        loteFivId = acas?.lote_fiv_id || null;
      }

      // 5. Get lab_id (use a constant for now — single lab)
      const labId = '00000000-0000-0000-0000-000000000001';

      // 6. Insert into embryo_references (atlas grows!)
      const aiSuggestedClass = score.knn_classification || null;
      const { error: refErr } = await supabase
        .from('embryo_references')
        .insert({
          lab_id: labId,
          lote_fiv_id: loteFivId,
          acasalamento_id: acasalamentoId,
          embriao_id: embriaoId,
          classification,
          embedding: score.embedding,
          kinetic_intensity: score.kinetic_intensity,
          kinetic_harmony: score.kinetic_harmony,
          kinetic_symmetry: score.kinetic_symmetry,
          kinetic_stability: score.kinetic_stability,
          kinetic_bg_noise: score.kinetic_bg_noise,
          best_frame_path: score.crop_image_path,
          motion_map_path: score.motion_map_path,
          composite_path: score.composite_path,
          ai_suggested_class: aiSuggestedClass,
          ai_confidence: score.knn_confidence,
          biologist_agreed: aiSuggestedClass ? aiSuggestedClass === classification : null,
          species: 'bovine_real',
          source: 'lab',
        });

      if (refErr) {
        console.error('Failed to insert atlas reference:', refErr);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['embryo-review', vars.queueId] });
      queryClient.invalidateQueries({ queryKey: ['atlas-stats'] });
    },
  });
}

// ─── useUndoClassification ───

interface UndoClassificationParams {
  scoreId: string;
  embriaoId: string;
  queueId: string;
}

export function useUndoClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scoreId, embriaoId }: UndoClassificationParams) => {
      // 1. Clear biologist classification from score
      await supabase
        .from('embryo_scores')
        .update({
          biologist_classification: null,
          biologist_agreed: null,
        })
        .eq('id', scoreId);

      // 2. Remove latest reference for this embryo from atlas
      const { data: refs } = await supabase
        .from('embryo_references')
        .select('id, created_at')
        .eq('embriao_id', embriaoId)
        .eq('species', 'bovine_real')
        .order('created_at', { ascending: false })
        .limit(1);

      if (refs && refs.length > 0) {
        const ref = refs[0];
        const refAge = Date.now() - new Date(ref.created_at).getTime();
        // Only allow undo within 5 minutes
        if (refAge <= 5 * 60 * 1000) {
          await supabase.from('embryo_references').delete().eq('id', ref.id);
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['embryo-review', vars.queueId] });
      queryClient.invalidateQueries({ queryKey: ['atlas-stats'] });
    },
  });
}

// ─── useAtlasStats ───

interface AtlasStats {
  total: number;
  bovine_real: number;
  bovine_rocha: number;
  human: number;
}

export function useAtlasStats() {
  return useQuery<AtlasStats>({
    queryKey: ['atlas-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('embryo_references')
        .select('id', { count: 'exact', head: true });

      const { count: bovineReal } = await supabase
        .from('embryo_references')
        .select('id', { count: 'exact', head: true })
        .eq('species', 'bovine_real');

      const { count: bovineRocha } = await supabase
        .from('embryo_references')
        .select('id', { count: 'exact', head: true })
        .eq('species', 'bovine_rocha');

      const { count: human } = await supabase
        .from('embryo_references')
        .select('id', { count: 'exact', head: true })
        .eq('species', 'human');

      return {
        total: total || 0,
        bovine_real: bovineReal || 0,
        bovine_rocha: bovineRocha || 0,
        human: human || 0,
      };
    },
    staleTime: 60_000,
  });
}

// ─── useDispatchLote ───

export function useDispatchLote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueId: string) => {
      // 1. Get embryos and their classifications from scores
      const { data: embrioes } = await supabase
        .from('embrioes')
        .select('id, identificacao, embryo_scores(biologist_classification)')
        .eq('queue_id', queueId)
        .eq('embryo_scores.is_current', true);

      if (!embrioes?.length) throw new Error('Nenhum embrião encontrado para despachar.');

      // 2. Update each embryo with its official classification
      const updates = embrioes.map(e => {
        const score = (e.embryo_scores as any)?.[0];
        return supabase
          .from('embrioes')
          .update({
            classificacao: score?.biologist_classification || 'Dg',
            data_classificacao: new Date().toISOString(),
            status_atual: 'FRESCO',
          })
          .eq('id', e.id);
      });

      await Promise.all(updates);

      // 3. Find and close the Lote FIV
      const { data: queue } = await supabase
        .from('embryo_analysis_queue')
        .select('lote_fiv_acasalamento_id')
        .eq('id', queueId)
        .single();

      if (queue?.lote_fiv_acasalamento_id) {
        const { data: acas } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('lote_fiv_id')
          .eq('id', queue.lote_fiv_acasalamento_id)
          .single();

        if (acas?.lote_fiv_id) {
          await supabase
            .from('lotes_fiv')
            .update({
              status: 'FECHADO',
              disponivel_para_transferencia: true,
            })
            .eq('id', acas.lote_fiv_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes-fiv'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-review'] });
    },
  });
}
