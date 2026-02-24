/**
 * Edge Function: embryo-analyze (v2.4)
 *
 * Pipeline DINOv2 + KNN + MLP com Pareamento Geográfico (X,Y)
 *
 * v2.4 Changelog:
 *  - KNN matching via match_embryos RPC → preenche combined_classification,
 *    knn_votes, knn_confidence, combined_source, combined_confidence
 *  - Frontend V2 mode agora ativado (antes combined_classification era sempre NULL)
 *
 * v2.3 Changelog:
 *  - Client Supabase no escopo superior (fix ReferenceError no catch)
 *  - INSERT em embryo_scores agora grava TODOS os campos V2
 *    (embedding, kinetics, MLP, motion_map_path, composite_path)
 *  - Upload de plate_frame ao Storage e plate_frame_path na queue
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DetectedBbox {
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  radius_px: number;
  texture_score?: number;
}

interface DINOv2Result {
  embedding: number[];
  kinetics: {
    intensity: number;
    harmony: number;
    symmetry: number;
    stability: number;
    background_noise: number;
  };
  best_frame_b64: string;
  motion_map_b64: string;
  composite_b64: string;
  frame_count: number;
  best_frame_index: number;
  mlp_classification?: {
    classification: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
}

function base64ToBuffer(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c: string) => c.charCodeAt(0));
}

interface KNNMatch {
  id: string;
  classification: string;
  similarity: number;
  species: string;
  kinetic_intensity: number | null;
  kinetic_harmony: number | null;
  pregnancy_result: boolean | null;
  best_frame_path: string | null;
  motion_map_path: string | null;
}

interface CombinedResult {
  knn_classification: string | null;
  knn_confidence: number | null;
  knn_votes: Record<string, number> | null;
  knn_neighbor_ids: string[] | null;
  knn_real_bovine_count: number;
  combined_classification: string;
  combined_source: 'knn' | 'knn_mlp_agree' | 'knn_mlp_disagree' | 'mlp_only' | 'insufficient';
  combined_confidence: number;
}

/**
 * Computa classificação combinada a partir de KNN + MLP.
 * Lógica:
 *  - Se KNN tem ≥3 vizinhos: voto majoritário = knn_classification
 *  - Se MLP e KNN concordam: combined_source = 'knn_mlp_agree', confiança +10
 *  - Se discordam: combined_source = 'knn_mlp_disagree', prevalece KNN
 *  - Se KNN insuficiente mas MLP existe: combined_source = 'mlp_only'
 *  - Senão: combined_source = 'insufficient'
 */
function computeCombinedClassification(
  neighbors: KNNMatch[],
  mlpResult?: { classification: string; confidence: number; probabilities: Record<string, number> } | null,
): CombinedResult {
  const MIN_NEIGHBORS = 3;
  const realBovineCount = neighbors.filter(n => n.species === 'bovine_real').length;

  // KNN votes
  const votes: Record<string, number> = {};
  for (const n of neighbors) {
    votes[n.classification] = (votes[n.classification] || 0) + 1;
  }

  let knnClass: string | null = null;
  let knnConf: number | null = null;
  const knnIds = neighbors.map(n => n.id);

  if (neighbors.length >= MIN_NEIGHBORS) {
    // Voto majoritário
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    knnClass = sorted[0][0];
    knnConf = Math.round((sorted[0][1] / neighbors.length) * 100);
  }

  const mlpClass = mlpResult?.classification ?? null;
  const mlpConf = mlpResult?.confidence ?? 0;

  // Determinar classificação combinada
  if (knnClass && mlpClass) {
    if (knnClass === mlpClass) {
      return {
        knn_classification: knnClass,
        knn_confidence: knnConf,
        knn_votes: votes,
        knn_neighbor_ids: knnIds,
        knn_real_bovine_count: realBovineCount,
        combined_classification: knnClass,
        combined_source: 'knn_mlp_agree',
        combined_confidence: Math.min(99, (knnConf || 0) + 10),
      };
    } else {
      // Discordam — prevalece KNN mas sinaliza divergência
      return {
        knn_classification: knnClass,
        knn_confidence: knnConf,
        knn_votes: votes,
        knn_neighbor_ids: knnIds,
        knn_real_bovine_count: realBovineCount,
        combined_classification: knnClass,
        combined_source: 'knn_mlp_disagree',
        combined_confidence: Math.max(knnConf || 0, mlpConf) - 10,
      };
    }
  } else if (knnClass) {
    return {
      knn_classification: knnClass,
      knn_confidence: knnConf,
      knn_votes: votes,
      knn_neighbor_ids: knnIds,
      knn_real_bovine_count: realBovineCount,
      combined_classification: knnClass,
      combined_source: 'knn',
      combined_confidence: knnConf || 50,
    };
  } else if (mlpClass) {
    return {
      knn_classification: null,
      knn_confidence: null,
      knn_votes: Object.keys(votes).length > 0 ? votes : null,
      knn_neighbor_ids: knnIds.length > 0 ? knnIds : null,
      knn_real_bovine_count: realBovineCount,
      combined_classification: mlpClass,
      combined_source: 'mlp_only',
      combined_confidence: mlpConf,
    };
  }

  // Insuficiente — nem KNN nem MLP
  return {
    knn_classification: null,
    knn_confidence: null,
    knn_votes: Object.keys(votes).length > 0 ? votes : null,
    knn_neighbor_ids: knnIds.length > 0 ? knnIds : null,
    knn_real_bovine_count: realBovineCount,
    combined_classification: mlpClass || 'ND',
    combined_source: 'insufficient',
    combined_confidence: 0,
  };
}

function mapToLegacyClassification(confidence: number): string {
  if (confidence >= 82) return 'Excelente';
  if (confidence >= 65) return 'Bom';
  if (confidence >= 48) return 'Regular';
  if (confidence >= 25) return 'Borderline';
  return 'Inviavel';
}

function mapToLegacyRecommendation(confidence: number): string {
  if (confidence >= 82) return 'priority';
  if (confidence >= 65) return 'recommended';
  if (confidence >= 48) return 'conditional';
  return 'second_opinion';
}

// ── FIX #1: Client Supabase no escopo superior ──
// Antes estava dentro do try (linha ~75), causando ReferenceError no catch
// quando req.json() falhava. Agora é acessível em qualquer ponto do handler.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!!
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  let queue_id: string | null = null;

  try {
    const body = await req.json();
    queue_id = body.queue_id;
    if (!queue_id) throw new Error('queue_id missing');

    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';
    const DINOV2_URL = Deno.env.get('DINOV2_CLOUD_RUN_URL') ?? '';

    // 1. Buscar Job
    const { data: job } = await supabase.from('embryo_analysis_queue').select('*').eq('id', queue_id).single();
    if (!job) throw new Error('Job not found');

    await supabase.from('embryo_analysis_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', queue_id);

    // 2. Buscar Mídia e Embriões do Banco
    const { data: media } = await supabase.from('acasalamento_embrioes_media').select('*').eq('id', job.media_id).single();
    const { data: dbEmbrioes } = await supabase.from('embrioes').select('*').eq('lote_fiv_acasalamento_id', job.lote_fiv_acasalamento_id).order('identificacao', { ascending: true });

    const embrioesNoBanco = dbEmbrioes || [];

    // 3. Obter URL do vídeo
    const { data: sUrl } = await supabase.storage.from('embryo-videos').createSignedUrl(media.arquivo_path, 600);
    const videoUrl = sUrl!!.signedUrl;

    // 4. Detecção Híbrida (Se não houver bboxes salvos)
    let detectedBboxes = (job.detected_bboxes as DetectedBbox[]) || [];
    if (detectedBboxes.length === 0) {
        console.log(`[Analyze] Iniciando nova detecção para ${embrioesNoBanco.length} embriões`);

        // 4a. Extrair Frame do Vídeo
        const frameResp = await fetch(`${FRAME_EXTRACTOR_URL}/extract-frame`, {
            method: 'POST',
            body: JSON.stringify({ video_url: videoUrl, position: 0.5 })
        });
        const frameData = await frameResp.json();
        const frame_base64 = frameData.frame_base64;

        // 4b. Chamar embryo-detect com o frame extraído
        const detResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/embryo-detect`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                frame_base64,
                expected_count: embrioesNoBanco.length,
                frame_width: frameData.width,
                frame_height: frameData.height
            })
        });
        const detData = await detResp.json();
        detectedBboxes = detData.bboxes || [];
        await supabase.from('embryo_analysis_queue').update({ detected_bboxes: detectedBboxes }).eq('id', queue_id);
    }

    if (detectedBboxes.length === 0) {
      // Graceful exit: IA funcionou mas não encontrou embriões claros
      const elapsed = Date.now() - startTime;
      await supabase.from('embryo_analysis_queue').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'Nenhum embrião claro detectado na imagem.',
      }).eq('id', queue_id);
      console.log(`[Analyze] 0 embriões detectados — finalizado em ${elapsed}ms`);
      return new Response(JSON.stringify({
        success: true,
        saved: 0,
        elapsed_ms: elapsed,
        message: 'Nenhum embrião claro detectado.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Extração de Crops (Usando coordenadas validadas)
    console.log(`[Analyze] Extraindo ${detectedBboxes.length} crops`);
    const cropResp = await fetch(`${FRAME_EXTRACTOR_URL}/extract-and-crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl, bboxes: detectedBboxes, frame_count: 40 })
    });
    const cropData = await cropResp.json();
    const embryoCrops: Record<string, string[]> = cropData.embryos || {};

    // ── FIX #3: Upload do Plate Frame e salvamento do path na fila ──
    if (cropData.plate_frame_b64) {
      const plateFramePath = `${job.lote_fiv_acasalamento_id}/${queue_id}/plate_frame.jpg`;
      await supabase.storage.from('embryoscore').upload(
        plateFramePath,
        base64ToBuffer(cropData.plate_frame_b64),
        { contentType: 'image/jpeg', upsert: true }
      );
      await supabase.from('embryo_analysis_queue').update({
        plate_frame_path: plateFramePath,
      }).eq('id', queue_id);
      console.log(`[Analyze] Plate frame salvo: ${plateFramePath}`);
    }

    // 6. DINOv2 + MLP (Sequencial por embrião)
    const successfulAnalyses: { embIdx: number; result: DINOv2Result }[] = [];
    for (const [idx, crops] of Object.entries(embryoCrops)) {
        if (!crops || crops.length < 5) continue;
        const formData = new FormData();
        formData.append('frames_json', JSON.stringify(crops));
        const resp = await fetch(`${DINOV2_URL}/analyze-embryo`, { method: 'POST', body: formData });
        if (resp.ok) {
            const res = (await resp.json()) as DINOv2Result;
            successfulAnalyses.push({ embIdx: parseInt(idx), result: res });
        }
    }

    // 7. Salvamento com Pareamento Geográfico, KNN e Gatekeeper
    const basePath = `${job.lote_fiv_acasalamento_id}/${queue_id}`;
    const scoresToInsert = [];

    for (const { embIdx, result } of successfulAnalyses) {
        const bbox = detectedBboxes[embIdx];
        const tScore = bbox.texture_score || 0;

        // Gatekeeper: Filtro de Realidade (Bolhas)
        if (tScore < 5.0 && result.kinetics.intensity < 2) {
            console.log(`[Gatekeeper] Rejeitado #${embIdx} (Texture: ${tScore.toFixed(1)})`);
            continue;
        }

        // Pareamento Geográfico (Proximidade)
        let closestEmb = null;
        let minDist = Infinity;
        for (const dbE of embrioesNoBanco) {
            const d = Math.sqrt(Math.pow((dbE.last_x_percent||0) - bbox.x_percent, 2) + Math.pow((dbE.last_y_percent||0) - bbox.y_percent, 2));
            if (d < minDist) { minDist = d; closestEmb = dbE; }
        }

        const embriao = (closestEmb && minDist < 15) ? closestEmb : embrioesNoBanco[embIdx];
        if (!embriao) continue;

        if (minDist >= 15 && closestEmb) {
            console.log(`[Analyze] Geo-match #${embIdx}: dist=${minDist.toFixed(1)}% > 15%, fallback para índice`);
        }

        const confidence = result.mlp_classification?.confidence || 50;

        // ── v2.4: KNN Matching via match_embryos RPC ──
        let combined: CombinedResult;
        try {
            const { data: knnNeighbors } = await supabase.rpc('match_embryos', {
                query_embedding: result.embedding,
                match_count: 10,
                min_similarity: 0.60,
            });
            combined = computeCombinedClassification(
                (knnNeighbors || []) as KNNMatch[],
                result.mlp_classification ?? null,
            );
            console.log(`[KNN] #${embIdx}: ${combined.combined_source} → ${combined.combined_classification} (${combined.combined_confidence}%, ${(knnNeighbors || []).length} vizinhos, ${combined.knn_real_bovine_count} reais)`);
        } catch (knnErr) {
            console.error(`[KNN] Falha #${embIdx}:`, knnErr);
            // Fallback: usa só MLP se disponível
            combined = computeCombinedClassification([], result.mlp_classification ?? null);
        }

        // Upload Imagem Principal (best frame)
        await supabase.storage.from('embryoscore').upload(`${basePath}/emb_${embIdx}.jpg`, base64ToBuffer(result.best_frame_b64), { contentType: 'image/jpeg', upsert: true });

        // Upload Motion Map ao Storage
        let motionMapPath: string | null = null;
        if (result.motion_map_b64) {
            motionMapPath = `${basePath}/motion_${embIdx}.jpg`;
            await supabase.storage.from('embryoscore').upload(
                motionMapPath,
                base64ToBuffer(result.motion_map_b64),
                { contentType: 'image/jpeg', upsert: true }
            );
        }

        // Upload Composite (morfologia + cinética lado a lado) ao Storage
        let compositePath: string | null = null;
        if (result.composite_b64) {
            compositePath = `${basePath}/composite_${embIdx}.jpg`;
            await supabase.storage.from('embryoscore').upload(
                compositePath,
                base64ToBuffer(result.composite_b64),
                { contentType: 'image/jpeg', upsert: true }
            );
        }

        // Payload completo — V1 (legado mantido) + V2 (KNN + DINOv2 + MLP)
        scoresToInsert.push({
            // ── Campos V1 (legado, mantidos para compatibilidade) ──
            embriao_id: embriao.id,
            media_id: job.media_id,
            queue_id: queue_id,
            is_current: true,
            embryo_score: confidence,
            classification: mapToLegacyClassification(confidence),
            transfer_recommendation: mapToLegacyRecommendation(confidence),
            confidence: 'medium',
            crop_image_path: `${basePath}/emb_${embIdx}.jpg`,
            bbox_x_percent: bbox.x_percent,
            bbox_y_percent: bbox.y_percent,
            texture_score: tScore,
            reasoning: `DINOv2+KNN (Dist: ${minDist.toFixed(1)}%, Src: ${combined.combined_source})`,
            model_used: 'dinov2_vitb14',

            // ── V2: Embedding (vector 768d para pgvector) ──
            embedding: result.embedding,

            // ── V2: Métricas Cinéticas (REAL) ──
            kinetic_intensity: result.kinetics.intensity,
            kinetic_harmony: result.kinetics.harmony,
            kinetic_symmetry: result.kinetics.symmetry,
            kinetic_stability: result.kinetics.stability,
            kinetic_bg_noise: result.kinetics.background_noise,

            // ── V2: Imagens (paths no bucket embryoscore) ──
            motion_map_path: motionMapPath,
            composite_path: compositePath,

            // ── V2: MLP Classification ──
            mlp_classification: result.mlp_classification?.classification ?? null,
            mlp_confidence: result.mlp_classification?.confidence ?? null,
            mlp_probabilities: result.mlp_classification?.probabilities ?? null,

            // ── V2: KNN + Combined (NOVO em v2.4) ──
            knn_classification: combined.knn_classification,
            knn_confidence: combined.knn_confidence,
            knn_votes: combined.knn_votes,
            knn_neighbor_ids: combined.knn_neighbor_ids,
            knn_real_bovine_count: combined.knn_real_bovine_count,
            combined_classification: combined.combined_classification,
            combined_source: combined.combined_source,
            combined_confidence: combined.combined_confidence,
        });

        // Atualizar coordenadas para o próximo match ser perfeito
        await supabase.from('embrioes').update({
            last_x_percent: bbox.x_percent,
            last_y_percent: bbox.y_percent,
            queue_id: queue_id
        }).eq('id', embriao.id);
    }

    if (scoresToInsert.length > 0) {
        // Soft delete scores anteriores
        await supabase.from('embryo_scores').update({ is_current: false }).in('embriao_id', scoresToInsert.map(s => s.embriao_id));
        await supabase.from('embryo_scores').insert(scoresToInsert);
    }

    const elapsed = Date.now() - startTime;
    await supabase.from('embryo_analysis_queue').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', queue_id);
    console.log(`[Analyze] Concluído: ${scoresToInsert.length} scores salvos em ${elapsed}ms`);

    return new Response(JSON.stringify({ success: true, saved: scoresToInsert.length, elapsed_ms: elapsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Analyze] ERRO:', error);
    // ── FIX #1 (cont.): supabase agora é sempre acessível aqui ──
    if (queue_id) {
      try {
        await supabase.from('embryo_analysis_queue').update({
          status: 'failed',
          error_message: String(error?.message || error).slice(0, 500),
        }).eq('id', queue_id);
      } catch (updateErr) {
        console.error('[Analyze] Falha ao marcar job como failed:', updateErr);
      }
    }
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
