/**
 * Edge Function: embryo-analyze (v2)
 *
 * Pipeline DINOv2 + KNN + MLP — sem IA generativa avaliando.
 *
 * Fluxo v2:
 * 1. Busca job → status processing
 * 2. Cloud Run /extract-frame (MANTIDO)
 * 3. Gemini box_2d detecção (MANTIDO — apenas para localizar embriões)
 * 4. Cloud Run /extract-and-crop (NOVO) → 40 crops/embrião + plate_frame
 * 5. Cloud Run DINOv2 /analyze-embryo (NOVO, GPU) → embedding 768d + MLP
 * 6. Supabase pgvector KNN → 10 vizinhos → votação
 * 7. Scoring dual (KNN + MLP) com peso dinâmico
 * 8. Salva imagens + scores → status completed
 *
 * Secrets:
 *   GEMINI_API_KEY - chave API Google Gemini (para detecção box_2d)
 *   FRAME_EXTRACTOR_URL - URL Cloud Run frame-extractor
 *   DINOV2_CLOUD_RUN_URL - URL Cloud Run DINOv2
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// CORS headers
// ============================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// Types
// ============================================================
interface DetectedBbox {
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  radius_px: number;
}

interface GeminiBox2dItem {
  box_2d: [number, number, number, number];
  label?: string;
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

interface KNNNeighbor {
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

interface KNNResult {
  classification: string | null;
  confidence: number;
  votes: Record<string, number>;
  neighbor_ids: string[];
  real_bovine_count: number;
  status: 'ok' | 'insufficient_data';
}

interface MLPResult {
  classification: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface CombinedScore {
  classification: string | null;
  confidence: number;
  source: 'knn' | 'knn_mlp_agree' | 'knn_mlp_disagree' | 'mlp_only' | 'insufficient';
}

// ============================================================
// Helpers
// ============================================================

/** Convert base64 to Uint8Array */
function base64ToBuffer(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c: string) => c.charCodeAt(0));
}

/** Compute KNN vote from neighbors */
function computeVote(neighbors: KNNNeighbor[], minNeighbors = 3): KNNResult {
  const goodNeighbors = neighbors.filter(n => n.similarity >= 0.65);

  if (goodNeighbors.length < minNeighbors) {
    return {
      classification: null,
      confidence: 0,
      votes: {},
      neighbor_ids: goodNeighbors.map(n => n.id),
      real_bovine_count: goodNeighbors.filter(n => n.species === 'bovine_real').length,
      status: 'insufficient_data',
    };
  }

  const votes: Record<string, number> = {};
  for (const n of goodNeighbors) {
    votes[n.classification] = (votes[n.classification] || 0) + 1;
  }
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);

  return {
    classification: sorted[0][0],
    confidence: Math.round((sorted[0][1] / goodNeighbors.length) * 100),
    votes: Object.fromEntries(sorted),
    neighbor_ids: goodNeighbors.map(n => n.id),
    real_bovine_count: goodNeighbors.filter(n => n.species === 'bovine_real').length,
    status: 'ok',
  };
}

/** Combine KNN + MLP scoring with dynamic weight */
function getCombinedScore(
  knnResult: KNNResult,
  mlpResult: MLPResult | null,
  realBovineTotal: number,
): CombinedScore {
  // Case 1: Atlas mature (200+ real bovine refs) → KNN dominates
  if (realBovineTotal >= 200 && knnResult.status !== 'insufficient_data') {
    return {
      classification: knnResult.classification,
      confidence: knnResult.confidence,
      source: 'knn',
    };
  }

  // Case 2: Atlas growing + KNN has data → combine
  if (knnResult.status !== 'insufficient_data' && mlpResult) {
    if (knnResult.classification === mlpResult.classification) {
      return {
        classification: knnResult.classification,
        confidence: Math.round(knnResult.confidence * 0.6 + mlpResult.confidence * 0.4),
        source: 'knn_mlp_agree',
      };
    }
    // Disagree → KNN has priority (visual similarity)
    const knnWeight = Math.min(realBovineTotal / 200, 1.0);
    const mlpWeight = 1.0 - knnWeight;
    return {
      classification: knnResult.classification,
      confidence: Math.round(knnResult.confidence * knnWeight + mlpResult.confidence * mlpWeight),
      source: 'knn_mlp_disagree',
    };
  }

  // Case 3: KNN has data but no MLP
  if (knnResult.status !== 'insufficient_data') {
    return {
      classification: knnResult.classification,
      confidence: knnResult.confidence,
      source: 'knn',
    };
  }

  // Case 4: KNN insufficient → MLP alone
  if (mlpResult && mlpResult.confidence >= 50) {
    return {
      classification: mlpResult.classification,
      confidence: mlpResult.confidence,
      source: 'mlp_only',
    };
  }

  // Case 5: Everything insufficient
  return {
    classification: null,
    confidence: 0,
    source: 'insufficient',
  };
}

// ============================================================
// Handler
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let queue_id: string | null = null;

  try {
    const body = await req.json();
    queue_id = body.queue_id;
    if (!queue_id) {
      return new Response(
        JSON.stringify({ error: 'queue_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gemini API key (for box_2d detection only)
    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    try {
      const { data: secretRow } = await supabase
        .from('embryo_score_secrets')
        .select('key_value')
        .eq('key_name', 'GEMINI_API_KEY')
        .maybeSingle();
      if (secretRow?.key_value) geminiApiKey = secretRow.key_value;
    } catch {
      console.warn('embryo_score_secrets: tabela não acessível, usando env var');
    }
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';
    const DINOV2_URL = Deno.env.get('DINOV2_CLOUD_RUN_URL') ?? '';
    if (!DINOV2_URL) {
      throw new Error('DINOV2_CLOUD_RUN_URL não configurada');
    }

    // ── PASSO 1: Buscar job ──
    const { data: job, error: jobError } = await supabase
      .from('embryo_analysis_queue')
      .select('*')
      .eq('id', queue_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job não encontrado: ${queue_id}`);
    }

    if (job.status !== 'pending' && job.status !== 'failed') {
      return new Response(
        JSON.stringify({ message: `Job já está ${job.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.retry_count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Job excedeu limite de 3 tentativas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PASSO 2: Status → processing ──
    await supabase
      .from('embryo_analysis_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        retry_count: (job.retry_count || 0) + 1,
      })
      .eq('id', queue_id);

    // ── PASSO 3: Buscar mídia ──
    const { data: media, error: mediaError } = await supabase
      .from('acasalamento_embrioes_media')
      .select('*')
      .eq('id', job.media_id)
      .single();

    if (mediaError || !media) {
      throw new Error(`Mídia não encontrada: ${job.media_id}`);
    }

    // ── PASSO 4: Buscar embriões do banco ──
    let embrioes: { id: string; identificacao: string }[] | null = null;

    const { data: embrioesQueue } = await supabase
      .from('embrioes')
      .select('id, identificacao')
      .eq('queue_id', queue_id)
      .order('identificacao', { ascending: true });

    if (embrioesQueue && embrioesQueue.length > 0) {
      embrioes = embrioesQueue;
    } else {
      const { data: embrioesMedia } = await supabase
        .from('embrioes')
        .select('id, identificacao')
        .eq('acasalamento_media_id', job.media_id)
        .order('identificacao', { ascending: true });

      if (embrioesMedia && embrioesMedia.length > 0) {
        embrioes = embrioesMedia;
      } else {
        const { data: embrioesAcas } = await supabase
          .from('embrioes')
          .select('id, identificacao')
          .eq('lote_fiv_acasalamento_id', job.lote_fiv_acasalamento_id)
          .order('identificacao', { ascending: true });
        embrioes = embrioesAcas;
      }
    }

    const embryoCountInDb = embrioes?.length ?? 0;
    console.log(`[v2] ${embryoCountInDb} embriões no banco`);

    // ── PASSO 4a: Buscar lote_fiv_id e acasalamento_id ──
    let loteFivId = 'unknown';
    let acasalamentoId = job.lote_fiv_acasalamento_id || 'unknown';
    try {
      const { data: acasLoteData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('lote_fiv_id')
        .eq('id', job.lote_fiv_acasalamento_id)
        .single();
      loteFivId = acasLoteData?.lote_fiv_id || 'unknown';
    } catch {
      console.warn('Não foi possível buscar lote_fiv_id');
    }

    // ── PASSO 4b: Reuse bboxes from previous analysis ──
    let detectedBboxes = (job.detected_bboxes as DetectedBbox[] | null) || null;
    let hasOpenCVBboxes = detectedBboxes && detectedBboxes.length > 0;
    const expectedCount = (job.expected_count as number | null) || embryoCountInDb;

    if (!hasOpenCVBboxes) {
      try {
        const { data: prevJob } = await supabase
          .from('embryo_analysis_queue')
          .select('detected_bboxes, detection_confidence')
          .eq('media_id', job.media_id)
          .neq('id', queue_id)
          .not('detected_bboxes', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevJob?.detected_bboxes && (prevJob.detected_bboxes as DetectedBbox[]).length > 0) {
          detectedBboxes = prevJob.detected_bboxes as DetectedBbox[];
          hasOpenCVBboxes = true;
          console.log(`[REUSE] Reutilizando ${detectedBboxes.length} bboxes de análise anterior`);
        }
      } catch {
        // ignore
      }
    }

    // ── PASSO 5: Signed URL do vídeo ──
    const { data: signedUrlData } = await supabase.storage
      .from('embryo-videos')
      .createSignedUrl(media.arquivo_path, 600);

    if (!signedUrlData?.signedUrl) {
      throw new Error('Falha ao criar signed URL do vídeo');
    }
    const videoUrl = signedUrlData.signedUrl;

    // ── PASSO 6: Server-side detection (se necessário) ──
    if (!hasOpenCVBboxes && FRAME_EXTRACTOR_URL && expectedCount > 0) {
      console.log(`[SERVER-DETECT] Extraindo frame para detecção`);

      const frameResp = await fetch(`${FRAME_EXTRACTOR_URL}/extract-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, position: 0.5 }),
      });

      if (!frameResp.ok) {
        throw new Error(`Cloud Run extract-frame falhou (${frameResp.status})`);
      }

      const { frame_base64, width: frameWidth, height: frameHeight } = await frameResp.json();
      if (!frame_base64) throw new Error('Cloud Run retornou frame vazio');

      // Gemini box_2d detection
      const modelName = 'gemini-2.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

      const detectionPrompt = `Detect EXACTLY ${expectedCount} bovine embryos in this IVF stereomicroscope image.
RULES:
- Return EXACTLY ${expectedCount} detections. No more, no less.
- Each detection must have box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000 and label "embryo".
- Embryos are DARK, OPAQUE, circular/oval structures sitting ON the culture medium.
- All real embryos have SIMILAR sizes (within 2x of each other).
REJECT: Bubbles (bright/transparent), debris (very small), well edges, shadows.
If you see fewer than ${expectedCount} clear embryos, return only confident ones.`;

      const detController = new AbortController();
      const detTimeoutId = setTimeout(() => detController.abort(), 60_000);

      const detResp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: detController.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: frame_base64 } },
              { text: detectionPrompt },
            ],
          }],
          generation_config: {
            temperature: 0,
            max_output_tokens: 8192,
            response_mime_type: 'application/json',
          },
        }),
      });

      clearTimeout(detTimeoutId);
      if (!detResp.ok) {
        throw new Error(`Gemini detection falhou (${detResp.status})`);
      }

      const detData = await detResp.json();
      const rawDetText = detData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawDetText) throw new Error('Gemini detection: sem texto');

      // Parse response
      let detJson = rawDetText.trim();
      if (detJson.startsWith('```')) {
        detJson = detJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      let parsedBoxes: GeminiBox2dItem[];
      try {
        const rawParsed = JSON.parse(detJson);
        if (Array.isArray(rawParsed)) {
          parsedBoxes = rawParsed;
        } else {
          const arrayProp = Object.values(rawParsed).find(
            (v) => Array.isArray(v) && v.length > 0 && (v[0] as GeminiBox2dItem)?.box_2d
          ) as GeminiBox2dItem[] | undefined;
          parsedBoxes = arrayProp || [];
        }
      } catch {
        parsedBoxes = [];
      }

      const fw = frameWidth || 1920;
      const fh = frameHeight || 1080;

      let rawBboxes: DetectedBbox[] = parsedBoxes
        .filter(item => item.box_2d && item.box_2d.length === 4)
        .map(item => {
          const [y_min, x_min, y_max, x_max] = item.box_2d;
          const x_percent = (x_min + x_max) / 2 / 10;
          const y_percent = (y_min + y_max) / 2 / 10;
          const width_percent = (x_max - x_min) / 10;
          const height_percent = (y_max - y_min) / 10;
          const radius_px = (width_percent / 100 * fw) / 2;
          return { x_percent, y_percent, width_percent, height_percent, radius_px };
        });

      // Filter outliers
      if (rawBboxes.length > 1) {
        const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
        const sortedAreas = [...areas].sort((a, b) => a - b);
        const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
        rawBboxes = rawBboxes.filter((_, i) => {
          const ratio = areas[i] / medianArea;
          return ratio >= 0.25 && ratio <= 4.0;
        });
      }

      // Limit to expected count
      if (rawBboxes.length > expectedCount) {
        const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
        const sortedAreas = [...areas].sort((a, b) => a - b);
        const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
        const indexed = rawBboxes.map((b, i) => ({ bbox: b, dist: Math.abs(areas[i] - medianArea) }));
        indexed.sort((a, b) => a.dist - b.dist);
        rawBboxes = indexed.slice(0, expectedCount).map(item => item.bbox);
      }

      // Sort reading order
      if (rawBboxes.length > 1) {
        const avgHeight = rawBboxes.reduce((s, b) => s + b.height_percent, 0) / rawBboxes.length;
        const rowTolerance = avgHeight * 0.7;
        const sorted = [...rawBboxes].sort((a, b) => a.y_percent - b.y_percent);
        const rows: DetectedBbox[][] = [];
        let currentRow: DetectedBbox[] = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
          if (Math.abs(sorted[i].y_percent - currentRow[0].y_percent) < rowTolerance) {
            currentRow.push(sorted[i]);
          } else {
            rows.push(currentRow);
            currentRow = [sorted[i]];
          }
        }
        rows.push(currentRow);
        for (const row of rows) row.sort((a, b) => a.x_percent - b.x_percent);
        rawBboxes = rows.flat();
      }

      detectedBboxes = rawBboxes;
      hasOpenCVBboxes = rawBboxes.length > 0;

      const detConf = rawBboxes.length === expectedCount ? 'high'
        : rawBboxes.length < expectedCount ? 'low' : 'medium';

      await supabase.from('embryo_analysis_queue').update({
        detected_bboxes: detectedBboxes,
        detection_confidence: detConf,
      }).eq('id', queue_id);

      console.log(`[SERVER-DETECT] ${rawBboxes.length} bboxes (confiança: ${detConf})`);
    }

    if (!hasOpenCVBboxes || !detectedBboxes || detectedBboxes.length === 0) {
      await supabase.from('embryo_analysis_queue').update({
        status: 'skipped',
        completed_at: new Date().toISOString(),
        error_message: 'Sem bboxes detectados',
      }).eq('id', queue_id);

      return new Response(
        JSON.stringify({ success: false, queue_id, status: 'skipped', reason: 'Sem bboxes detectados' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PASSO 7: Cloud Run /extract-and-crop ──
    console.log(`[v2] Extraindo crops de ${detectedBboxes.length} embriões`);

    const cropResp = await fetch(`${FRAME_EXTRACTOR_URL}/extract-and-crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        bboxes: detectedBboxes.map(b => ({
          x_percent: b.x_percent,
          y_percent: b.y_percent,
          width_percent: b.width_percent,
          height_percent: b.height_percent,
        })),
        frame_count: 40,
      }),
    });

    if (!cropResp.ok) {
      const errText = await cropResp.text();
      throw new Error(`/extract-and-crop falhou (${cropResp.status}): ${errText.substring(0, 300)}`);
    }

    const cropData = await cropResp.json();
    const embryoCrops: Record<string, string[]> = cropData.embryos || {};
    const plateFrameB64: string | null = cropData.plate_frame_b64 || null;

    console.log(`[v2] Crops extraídos: ${Object.keys(embryoCrops).length} embriões, ${cropData.frames_extracted} frames`);

    // ── PASSO 7b: Salvar plate_frame no Storage ──
    const basePath = `${loteFivId}/${acasalamentoId}/${queue_id}`;
    let plateFramePath: string | null = null;

    if (plateFrameB64) {
      plateFramePath = `${basePath}/plate_frame.jpg`;
      const { error: plateUploadErr } = await supabase.storage
        .from('embryoscore')
        .upload(plateFramePath, base64ToBuffer(plateFrameB64), { contentType: 'image/jpeg' });

      if (plateUploadErr) {
        console.warn(`plate_frame upload falhou: ${plateUploadErr.message}`);
        plateFramePath = null;
      }
    }

    // Update queue with plate_frame_path
    await supabase.from('embryo_analysis_queue').update({
      plate_frame_path: plateFramePath,
      detected_bboxes: detectedBboxes,
    }).eq('id', queue_id);

    // ── PASSO 8: DINOv2 em PARALELO para cada embrião ──
    console.log(`[v2] Chamando DINOv2 para ${Object.keys(embryoCrops).length} embriões em paralelo`);

    const analyzePromises = Object.entries(embryoCrops).map(
      async ([embIdxStr, crops]): Promise<{ embIdx: number; result: DINOv2Result | null; error: string | null }> => {
        const embIdx = parseInt(embIdxStr);
        if (!crops || crops.length < 5) {
          return { embIdx, result: null, error: `Crops insuficientes: ${crops?.length ?? 0}` };
        }
        try {
          const formData = new FormData();
          formData.append('frames_json', JSON.stringify(crops));

          const resp = await fetch(`${DINOV2_URL}/analyze-embryo`, {
            method: 'POST',
            body: formData,
          });

          if (!resp.ok) {
            const errText = await resp.text();
            return { embIdx, result: null, error: `DINOv2 falhou (${resp.status}): ${errText.substring(0, 200)}` };
          }

          const result = await resp.json() as DINOv2Result;
          return { embIdx, result, error: null };
        } catch (err) {
          return { embIdx, result: null, error: String(err) };
        }
      }
    );

    const analyzeResults = await Promise.all(analyzePromises);
    const successfulAnalyses = analyzeResults.filter(r => r.result);
    const failedAnalyses = analyzeResults.filter(r => !r.result);

    if (failedAnalyses.length > 0) {
      console.warn(`[v2] ${failedAnalyses.length} DINOv2 calls falharam:`,
        failedAnalyses.map(r => `#${r.embIdx}: ${r.error?.substring(0, 100)}`));
    }

    if (successfulAnalyses.length === 0) {
      const errorMsg = `Todas DINOv2 calls falharam: ${failedAnalyses.map(r => r.error?.substring(0, 80)).join('; ')}`;
      await supabase.from('embryo_analysis_queue').update({
        status: 'failed',
        error_message: errorMsg.substring(0, 500),
        completed_at: new Date().toISOString(),
      }).eq('id', queue_id);

      return new Response(
        JSON.stringify({ success: false, queue_id, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[v2] ${successfulAnalyses.length}/${analyzeResults.length} DINOv2 ok`);

    // ── PASSO 9: KNN em PARALELO ──
    // First, get atlas stats for dynamic weighting
    let realBovineTotal = 0;
    try {
      const { count } = await supabase
        .from('embryo_references')
        .select('id', { count: 'exact', head: true })
        .eq('species', 'bovine_real');
      realBovineTotal = count || 0;
    } catch {
      console.warn('[v2] Falha ao contar referências bovinas reais');
    }

    console.log(`[v2] Atlas: ${realBovineTotal} bovinas reais`);

    const knnPromises = successfulAnalyses.map(
      async ({ embIdx, result }): Promise<{ embIdx: number; knnResult: KNNResult }> => {
        try {
          const { data: neighbors } = await supabase.rpc('match_embryos', {
            query_embedding: JSON.stringify(result!.embedding),
            match_count: 10,
          });

          return {
            embIdx,
            knnResult: computeVote((neighbors || []) as KNNNeighbor[]),
          };
        } catch (err) {
          console.warn(`[v2] KNN #${embIdx} falhou: ${err}`);
          return {
            embIdx,
            knnResult: {
              classification: null, confidence: 0, votes: {},
              neighbor_ids: [], real_bovine_count: 0, status: 'insufficient_data',
            },
          };
        }
      }
    );

    const knnResults = await Promise.all(knnPromises);

    // ── PASSO 10: Salvar imagens no Storage ──
    for (const { embIdx, result } of successfulAnalyses) {
      if (!result) continue;
      const imgPromises = [
        supabase.storage.from('embryoscore').upload(
          `${basePath}/emb_${embIdx}_frame.jpg`,
          base64ToBuffer(result.best_frame_b64),
          { contentType: 'image/jpeg' }),
        supabase.storage.from('embryoscore').upload(
          `${basePath}/emb_${embIdx}_motion.jpg`,
          base64ToBuffer(result.motion_map_b64),
          { contentType: 'image/jpeg' }),
        supabase.storage.from('embryoscore').upload(
          `${basePath}/emb_${embIdx}_composite.jpg`,
          base64ToBuffer(result.composite_b64),
          { contentType: 'image/jpeg' }),
      ];
      const uploadResults = await Promise.all(imgPromises);
      for (const { error } of uploadResults) {
        if (error) console.warn(`[v2] Image upload falhou: ${error.message}`);
      }
    }

    // ── PASSO 11: Salvar scores ──
    let nextVersion = 1;
    if (embrioes && embrioes.length > 0) {
      const { data: versionData } = await supabase
        .from('embryo_scores')
        .select('analysis_version')
        .in('embriao_id', embrioes.map(e => e.id))
        .order('analysis_version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (versionData?.analysis_version) {
        nextVersion = (versionData.analysis_version as number) + 1;
      }
    }

    const processingTime = Date.now() - startTime;

    const scoresToInsert = successfulAnalyses.map(({ embIdx, result }) => {
      const embriao = embrioes?.[embIdx];
      const knn = knnResults.find(k => k.embIdx === embIdx)?.knnResult ?? {
        classification: null, confidence: 0, votes: {},
        neighbor_ids: [], real_bovine_count: 0, status: 'insufficient_data' as const,
      };
      const mlp = result!.mlp_classification || null;
      const combined = getCombinedScore(knn, mlp, realBovineTotal);
      const kinetics = result!.kinetics;
      const bbox = detectedBboxes![embIdx];

      return {
        embriao_id: embriao?.id || null,
        media_id: job.media_id,
        is_current: true,
        analysis_version: nextVersion,

        // Combined score (v2)
        embryo_score: combined.confidence, // backward compat: use confidence as score
        classification: combined.classification,
        confidence: combined.source === 'insufficient' ? 'low' : combined.confidence >= 70 ? 'high' : 'medium',
        transfer_recommendation: null,
        reasoning: null,

        // KNN fields
        knn_classification: knn.classification,
        knn_confidence: knn.confidence,
        knn_votes: knn.votes,
        knn_neighbor_ids: knn.neighbor_ids,
        knn_real_bovine_count: knn.real_bovine_count,

        // MLP fields
        mlp_classification: mlp?.classification || null,
        mlp_confidence: mlp?.confidence || null,
        mlp_probabilities: mlp?.probabilities || null,

        // Combined fields
        combined_source: combined.source,
        combined_classification: combined.classification,
        combined_confidence: combined.confidence,

        // Embedding
        embedding: JSON.stringify(result!.embedding),

        // Kinetic metrics
        kinetic_intensity: kinetics.intensity,
        kinetic_harmony: kinetics.harmony,
        kinetic_symmetry: kinetics.symmetry,
        kinetic_stability: kinetics.stability,
        kinetic_bg_noise: kinetics.background_noise,

        // Image paths
        crop_image_path: `${basePath}/emb_${embIdx}_frame.jpg`,
        motion_map_path: `${basePath}/emb_${embIdx}_motion.jpg`,
        composite_path: `${basePath}/emb_${embIdx}_composite.jpg`,

        // Position
        bbox_x_percent: bbox?.x_percent ?? null,
        bbox_y_percent: bbox?.y_percent ?? null,
        bbox_width_percent: bbox?.width_percent ?? null,
        bbox_height_percent: bbox?.height_percent ?? null,

        // Meta
        model_used: 'dinov2_vitb14',
        prompt_version: 'v2',
        processing_time_ms: processingTime,

        // Legacy v1 fields (null)
        morph_score: null,
        kinetic_score: null,
        stage: null,
        icm_grade: null,
        te_grade: null,
        morph_notes: null,
        kinetic_notes: null,

        raw_response: {
          _meta: {
            analysis_mode: 'v2-dinov2-knn-mlp',
            original_index: embIdx,
            embryos_in_db: embryoCountInDb,
            embryos_detected_by_ai: successfulAnalyses.length,
            count_mismatch: embryoCountInDb !== successfulAnalyses.length,
            atlas_real_bovine: realBovineTotal,
            knn_status: knn.status,
            combined_source: combined.source,
            frame_count: result!.frame_count,
            best_frame_index: result!.best_frame_index,
          },
        },
      };
    });

    const validScores = scoresToInsert.filter(s => s.embriao_id);

    if (validScores.length > 0) {
      const embriaoIds = validScores.map(s => s.embriao_id!);

      // Soft-delete previous scores
      await supabase
        .from('embryo_scores')
        .update({ is_current: false })
        .in('embriao_id', embriaoIds)
        .eq('is_current', true);

      const { error: insertError } = await supabase
        .from('embryo_scores')
        .insert(validScores);

      if (insertError) {
        throw new Error(`Erro ao salvar scores: ${insertError.message}`);
      }
    }

    // ── PASSO 12: Status → completed ──
    await supabase.from('embryo_analysis_queue').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', queue_id);

    return new Response(
      JSON.stringify({
        success: true,
        queue_id,
        analysis_mode: 'v2-dinov2-knn-mlp',
        embryos_analyzed: successfulAnalyses.length,
        embryos_in_db: embryoCountInDb,
        scores_saved: validScores.length,
        atlas_real_bovine: realBovineTotal,
        processing_time_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('embryo-analyze v2 error:', errorMessage);

    if (queue_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase.from('embryo_analysis_queue').update({
          status: 'failed',
          error_message: errorMessage.substring(0, 500),
          completed_at: new Date().toISOString(),
        }).eq('id', queue_id);
      } catch {
        console.error('Falha ao atualizar job para failed');
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
