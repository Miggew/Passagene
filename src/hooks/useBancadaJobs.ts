/**
 * useBancadaJobs — Hooks for the Bancada page.
 *
 * Separate queries (no nested joins) per CLAUDE.md:
 * 1. embryo_analysis_queue — job list
 * 2. embrioes — counts per queue
 * 3. lote_fiv_acasalamentos — doadora/dose names
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface BancadaJob {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expected_count: number;
  lote_fiv_acasalamento_id: string;
  media_id: string;
  manual_bboxes: any[] | null;
  detected_bboxes: any[] | null;
  plate_frame_path: string | null;
  // Joined data
  doadora_nome?: string;
  dose_nome?: string;
  embryo_count?: number;
  classified_count?: number;
  lote_fiv_id?: string;
  lote_data_abertura?: string;
  lote_fazenda_nome?: string;
  lote_status?: string;
}

export interface BancadaLoteGroup {
  lote_fiv_id: string | null;
  data_abertura: string | null;
  fazenda_nome: string | null;
  lote_status: string | null;
  dia_atual: number | null;
  jobs: BancadaJob[];
  total_embryos: number;
  total_classified: number;
}

/** Calcula dia de cultivo (Dx) a partir de data_abertura (D0). */
function calcDiaAtual(dataAbertura: string | null): number | null {
  if (!dataAbertura) return null;
  const [y, m, d] = dataAbertura.split('-').map(Number);
  const d0 = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - d0.getTime()) / 86400000));
}

export function groupJobsByLote(jobs: BancadaJob[]): BancadaLoteGroup[] {
  const map = new Map<string, BancadaLoteGroup>();
  const orphans: BancadaJob[] = [];

  for (const job of jobs) {
    const loteId = job.lote_fiv_id;
    if (!loteId) {
      orphans.push(job);
      continue;
    }
    if (!map.has(loteId)) {
      map.set(loteId, {
        lote_fiv_id: loteId,
        data_abertura: job.lote_data_abertura || null,
        fazenda_nome: job.lote_fazenda_nome || null,
        lote_status: job.lote_status || null,
        dia_atual: calcDiaAtual(job.lote_data_abertura || null),
        jobs: [],
        total_embryos: 0,
        total_classified: 0,
      });
    }
    const group = map.get(loteId)!;
    group.jobs.push(job);
    group.total_embryos += job.embryo_count || 0;
    group.total_classified += job.classified_count || 0;
  }

  // Sort groups by date DESC
  const groups = [...map.values()].sort((a, b) => {
    if (!a.data_abertura) return 1;
    if (!b.data_abertura) return -1;
    return b.data_abertura.localeCompare(a.data_abertura);
  });

  // Orphan bucket at end
  if (orphans.length > 0) {
    groups.push({
      lote_fiv_id: null,
      data_abertura: null,
      fazenda_nome: null,
      lote_status: null,
      dia_atual: null,
      jobs: orphans,
      total_embryos: orphans.reduce((s, j) => s + (j.embryo_count || 0), 0),
      total_classified: orphans.reduce((s, j) => s + (j.classified_count || 0), 0),
    });
  }

  return groups;
}

export function useBancadaJobs() {
  return useQuery({
    queryKey: ['bancada-jobs'],
    queryFn: async (): Promise<BancadaJob[]> => {
      // 1. Fetch recent queue jobs
      const { data: jobs, error: jobsErr } = await supabase
        .from('embryo_analysis_queue')
        .select('id, status, created_at, started_at, completed_at, expected_count, lote_fiv_acasalamento_id, media_id, manual_bboxes, detected_bboxes, plate_frame_path')
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsErr || !jobs?.length) return [];

      // 2. Fetch embryo counts per queue
      const queueIds = jobs.map((j) => j.id);
      const { data: embryos } = await supabase
        .from('embrioes')
        .select('id, queue_id, classificacao')
        .in('queue_id', queueIds);

      const embryoCountMap: Record<string, { total: number; classified: number }> = {};
      for (const emb of embryos || []) {
        if (!emb.queue_id) continue;
        if (!embryoCountMap[emb.queue_id]) embryoCountMap[emb.queue_id] = { total: 0, classified: 0 };
        embryoCountMap[emb.queue_id].total++;
        if (emb.classificacao && ['BE', 'BN', 'BX', 'BL', 'BI', 'Mo', 'Dg'].includes(emb.classificacao)) {
          embryoCountMap[emb.queue_id].classified++;
        }
      }

      // 3. Resolve doadora/touro names via separate queries (no nested joins)
      const acasIds = [...new Set(jobs.map((j) => j.lote_fiv_acasalamento_id).filter(Boolean))];
      const acasMap: Record<string, { doadora_nome?: string; dose_nome?: string; lote_fiv_id?: string }> = {};

      if (acasIds.length > 0) {
        // 3a. acasalamentos → aspiracao_doadora_id + dose_semen_id + lote_fiv_id
        const { data: acasRows } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id, lote_fiv_id')
          .in('id', acasIds);

        if (acasRows?.length) {
          // 3b. aspiracoes_doadoras → doadora_id
          const aspIds = [...new Set(acasRows.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
          const { data: aspRows } = aspIds.length > 0
            ? await supabase.from('aspiracoes_doadoras').select('id, doadora_id').in('id', aspIds)
            : { data: [] };

          // 3c. doadoras → registro (campo principal de identificação)
          const doadoraIds = [...new Set((aspRows || []).map((a) => a.doadora_id).filter(Boolean))];
          const { data: doadoraRows } = doadoraIds.length > 0
            ? await supabase.from('doadoras').select('id, registro, nome').in('id', doadoraIds)
            : { data: [] };
          const doadoraMap = new Map((doadoraRows || []).map((d) => [d.id, d.registro || d.nome]));
          const aspDoadoraMap = new Map((aspRows || []).map((a) => [a.id, doadoraMap.get(a.doadora_id) || '']));

          // 3d. doses_semen → touro nome (via touros or direct field)
          const doseIds = [...new Set(acasRows.map((a) => a.dose_semen_id).filter(Boolean))];
          const { data: doseRows } = doseIds.length > 0
            ? await supabase.from('doses_semen').select('id, touro_id').in('id', doseIds)
            : { data: [] };
          const touroIds = [...new Set((doseRows || []).map((d) => d.touro_id).filter(Boolean))];
          const { data: touroRows } = touroIds.length > 0
            ? await supabase.from('touros').select('id, nome').in('id', touroIds)
            : { data: [] };
          const touroMap = new Map((touroRows || []).map((t) => [t.id, t.nome]));
          const doseTouroMap = new Map((doseRows || []).map((d) => [d.id, touroMap.get(d.touro_id) || '']));

          // Build map
          for (const ac of acasRows) {
            acasMap[ac.id] = {
              doadora_nome: aspDoadoraMap.get(ac.aspiracao_doadora_id) || undefined,
              dose_nome: doseTouroMap.get(ac.dose_semen_id) || undefined,
              lote_fiv_id: ac.lote_fiv_id || undefined,
            };
          }
        }
      }

      // 4. Fetch lotes_fiv data + fazenda names via separate queries
      const loteFivIds = [...new Set(Object.values(acasMap).map((a) => a.lote_fiv_id).filter(Boolean))] as string[];
      const loteInfoMap = new Map<string, { data_abertura?: string; status?: string; fazenda_nome?: string }>();

      if (loteFivIds.length > 0) {
        const { data: loteRows } = await supabase
          .from('lotes_fiv')
          .select('id, data_abertura, status, pacote_aspiracao_id')
          .in('id', loteFivIds);

        if (loteRows?.length) {
          // 4b. pacotes_aspiracao → fazenda_id
          const pacoteIds = [...new Set(loteRows.map((l) => l.pacote_aspiracao_id).filter(Boolean))];
          const { data: pacoteRows } = pacoteIds.length > 0
            ? await supabase.from('pacotes_aspiracao').select('id, fazenda_id').in('id', pacoteIds)
            : { data: [] };

          // 4c. fazendas → nome
          const fazendaIds = [...new Set((pacoteRows || []).map((p) => p.fazenda_id).filter(Boolean))];
          const { data: fazendaRows } = fazendaIds.length > 0
            ? await supabase.from('fazendas').select('id, nome').in('id', fazendaIds)
            : { data: [] };
          const fazendaMap = new Map((fazendaRows || []).map((f) => [f.id, f.nome]));
          const pacoteFazendaMap = new Map((pacoteRows || []).map((p) => [p.id, fazendaMap.get(p.fazenda_id) || '']));

          for (const l of loteRows) {
            loteInfoMap.set(l.id, {
              data_abertura: l.data_abertura || undefined,
              status: l.status || undefined,
              fazenda_nome: pacoteFazendaMap.get(l.pacote_aspiracao_id) || undefined,
            });
          }
        }
      }

      // Merge
      return jobs.map((j) => {
        const acas = acasMap[j.lote_fiv_acasalamento_id];
        const loteInfo = acas?.lote_fiv_id ? loteInfoMap.get(acas.lote_fiv_id) : undefined;
        return {
          ...j,
          doadora_nome: acas?.doadora_nome,
          dose_nome: acas?.dose_nome,
          embryo_count: embryoCountMap[j.id]?.total || j.expected_count || 0,
          classified_count: embryoCountMap[j.id]?.classified || 0,
          lote_fiv_id: acas?.lote_fiv_id,
          lote_data_abertura: loteInfo?.data_abertura,
          lote_fazenda_nome: loteInfo?.fazenda_nome,
          lote_status: loteInfo?.status,
        };
      });
    },
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (!jobs) return 5000;
      const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'processing');
      return hasActive ? 5000 : false;
    },
  });
}

export interface BancadaPlateScore {
  id: string;
  gemini_classification: string | null;
  gemini_reasoning: string | null;
  crop_image_path: string | null;
  motion_map_path: string | null;
  kinetic_intensity: number | null;
  kinetic_harmony: number | null;
  kinetic_stability: number | null;
  biologist_classification: string | null;
  combined_classification: string | null;
  combined_confidence: number | null;
  combined_source: string | null;
  knn_votes: Record<string, number> | null;
  stage_code: number | null;
  quality_grade: number | null;
  visual_features: Record<string, any> | null;
  ai_confidence: number | null;
  knn_real_bovine_count: number | null;
  mlp_classification: string | null;
  mlp_confidence: number | null;
}

export interface BancadaPlateEmbryo {
  id: string;
  identificacao?: string;
  classificacao?: string;
  score?: BancadaPlateScore | null;
}

export function useBancadaPlate(queueId: string | null) {
  return useQuery({
    queryKey: ['bancada-plate', queueId],
    enabled: !!queueId,
    queryFn: async (): Promise<{
      job: BancadaJob | null;
      embryos: BancadaPlateEmbryo[];
    }> => {
      if (!queueId) return { job: null, embryos: [] };

      // 1. Queue job
      const { data: job } = await supabase
        .from('embryo_analysis_queue')
        .select('id, status, created_at, completed_at, expected_count, lote_fiv_acasalamento_id, media_id, manual_bboxes, detected_bboxes, plate_frame_path')
        .eq('id', queueId)
        .single();

      if (!job) return { job: null, embryos: [] };

      // 2. Embryos
      const { data: embryos } = await supabase
        .from('embrioes')
        .select('id, identificacao, classificacao')
        .eq('queue_id', queueId)
        .order('identificacao');

      // 3. Scores
      const embryoIds = (embryos || []).map((e) => e.id);
      const { data: scores } = embryoIds.length > 0
        ? await supabase
            .from('embryo_scores')
            .select('id, embriao_id, gemini_classification, gemini_reasoning, crop_image_path, motion_map_path, kinetic_intensity, kinetic_harmony, kinetic_stability, biologist_classification, combined_classification, combined_confidence, combined_source, knn_votes, stage_code, quality_grade, visual_features, ai_confidence, knn_real_bovine_count, mlp_classification, mlp_confidence')
            .in('embriao_id', embryoIds)
            .eq('is_current', true)
        : { data: [] };

      const scoreMap: Record<string, typeof scores extends (infer T)[] | null ? T : never> = {};
      for (const s of scores || []) {
        scoreMap[s.embriao_id] = s;
      }

      return {
        job: job as BancadaJob,
        embryos: (embryos || []).map((e) => ({
          ...e,
          score: scoreMap[e.id] || null,
        })),
      };
    },
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      return (status === 'pending' || status === 'processing') ? 3000 : false;
    },
  });
}
