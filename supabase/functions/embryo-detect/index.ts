/**
 * Edge Function: embryo-detect (v2.1)
 *
 * Detecta embriões em um frame de estereomicroscópio usando Gemini box_2d.
 *
 * Mudanças v2.1:
 * - Tiling Strategy: Divide a imagem em 4 quadrantes com sobreposição para detectar embriões pequenos/detalhados.
 * - Parallel Execution: 4 chamadas simultâneas ao Gemini.
 * - Global NMS: Unifica bboxes dos 4 tiles e remove duplicatas.
 * - Prompt Refinado: Inclui embriões expandidos (transparentes) e eclodidos.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

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
  confidence?: number;
  tile?: string; // Debug info: 'TL', 'TR', 'BL', 'BR'
}

interface GeminiBox2dItem {
  box_2d: [number, number, number, number]; // [y_min, x_min, y_max, x_max] normalized 0-1000
  label?: string;
  confidence?: number;
}

// ============================================================
// Helpers
// ============================================================

function calculateIoU(box1: DetectedBbox, box2: DetectedBbox): number {
  // Coordenadas normalizadas (percent) funcionam para IoU relativo
  const b1_x1 = box1.x_percent - box1.width_percent / 2;
  const b1_x2 = box1.x_percent + box1.width_percent / 2;
  const b1_y1 = box1.y_percent - box1.height_percent / 2;
  const b1_y2 = box1.y_percent + box1.height_percent / 2;

  const b2_x1 = box2.x_percent - box2.width_percent / 2;
  const b2_x2 = box2.x_percent + box2.width_percent / 2;
  const b2_y1 = box2.y_percent - box2.height_percent / 2;
  const b2_y2 = box2.y_percent + box2.height_percent / 2;

  const x_inter_1 = Math.max(b1_x1, b2_x1);
  const y_inter_1 = Math.max(b1_y1, b2_y1);
  const x_inter_2 = Math.min(b1_x2, b2_x2);
  const y_inter_2 = Math.min(b1_y2, b2_y2);

  if (x_inter_2 < x_inter_1 || y_inter_2 < y_inter_1) return 0;

  const area_inter = (x_inter_2 - x_inter_1) * (y_inter_2 - y_inter_1);
  const area_box1 = (b1_x2 - b1_x1) * (b1_y2 - b1_y1);
  const area_box2 = (b2_x2 - b2_x1) * (b2_y2 - b2_y1);

  const area_union = area_box1 + area_box2 - area_inter;
  return area_inter / area_union;
}

function nonMaximumSuppression(bboxes: DetectedBbox[], iouThreshold = 0.5): DetectedBbox[] {
  if (bboxes.length === 0) return [];

  // Ordenar por confiança (priorizar aspect ratio próximo de 1 como proxy de "redondo")
  const scored = bboxes.map(b => {
    const ratio = b.width_percent / b.height_percent;
    const shapeScore = 1 - Math.abs(1 - ratio);
    // Combinar score de forma e confiança do modelo se disponível
    const combinedScore = (b.confidence || 0.8) * shapeScore;
    return { bbox: b, score: combinedScore };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: DetectedBbox[] = [];
  const indices = new Set(scored.map((_, i) => i));

  while (indices.size > 0) {
    const currentIdx = Array.from(indices)[0];
    const current = scored[currentIdx];
    selected.push(current.bbox);
    indices.delete(currentIdx);

    const toRemove: number[] = [];
    indices.forEach(idx => {
      const other = scored[idx];
      const iou = calculateIoU(current.bbox, other.bbox);

      // Calculate Containment (Intersection / Smaller Area)
      const inter = getIntersectionArea(current.bbox, other.bbox);
      const outputArea = (current.bbox.width_percent * current.bbox.height_percent);
      const otherArea = (other.bbox.width_percent * other.bbox.height_percent);
      const minArea = Math.min(outputArea, otherArea);
      const containment = minArea > 0 ? inter / minArea : 0;

      // Duplicate if high IoU OR high Containment (one inside another)
      if (iou >= iouThreshold || containment > 0.85) {
        toRemove.push(idx);
      }
    });

    toRemove.forEach(idx => indices.delete(idx));
  }

  return selected;
}

function getIntersectionArea(box1: DetectedBbox, box2: DetectedBbox): number {
  const b1_x1 = box1.x_percent - box1.width_percent / 2;
  const b1_x2 = box1.x_percent + box1.width_percent / 2;
  const b1_y1 = box1.y_percent - box1.height_percent / 2;
  const b1_y2 = box1.y_percent + box1.height_percent / 2;

  const b2_x1 = box2.x_percent - box2.width_percent / 2;
  const b2_x2 = box2.x_percent + box2.width_percent / 2;
  const b2_y1 = box2.y_percent - box2.height_percent / 2;
  const b2_y2 = box2.y_percent + box2.height_percent / 2;

  const x_inter_1 = Math.max(b1_x1, b2_x1);
  const y_inter_1 = Math.max(b1_y1, b2_y1);
  const x_inter_2 = Math.min(b1_x2, b2_x2);
  const y_inter_2 = Math.min(b1_y2, b2_y2);

  if (x_inter_2 < x_inter_1 || y_inter_2 < y_inter_1) return 0;
  return (x_inter_2 - x_inter_1) * (y_inter_2 - y_inter_1);
}

// Prompt OTIMIZADO (v2.1)
const DETECTION_PROMPT = `Analyze this bovine IVF stereomicroscope image.
Task: Detect ALL visible bovine embryos (Day 7 blastocysts/morulae).

FORMAT:
Return a valid JSON array of objects. Each object must have:
- "box_2d": [ymin, xmin, ymax, xmax] (coordinates normalized 0-1000)
- "confidence": number (0.0 to 1.0)

VISUAL GUIDES:
1. **Compacted Morulae/Early Blastocysts**: Dark/granular, opaque circular objects.
2. **Expanded Blastocysts**: Large, TRANSPARENT/TRANSLUCENT spheres with a distinct thin ring (Zona Pellucida). Look carefully for these "glassy" circles.
3. **Hatched Blastocysts**: Irregular "8-shape" or oval forms extruding from the shell.

IGNORE:
- Air bubbles (bright, high contrast black rings with white centers).
- Debris (small irregular specks).
- Reflections on the plastic surface.

HINT: Return boxes ONLY for confident embryos. Do not hallucinate to match a count.`;

async function detectOnTile(
  tileBase64: string,
  geminiUrl: string,
  tileInfo: { name: string, xOff: number, yOff: number, width: number, height: number, fullW: number, fullH: number }
): Promise<DetectedBbox[]> {
  try {
    const resp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: tileBase64 } },
            { text: DETECTION_PROMPT },
          ]
        }],
        generation_config: {
          temperature: 0.1,
          max_output_tokens: 8192,
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return [];

    let jsonStr = rawText.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    let parsed: GeminiBox2dItem[] = [];

    try {
      const obj = JSON.parse(jsonStr);
      if (Array.isArray(obj)) parsed = obj;
      else if (typeof obj === 'object') {
        const arr = Object.values(obj).find(v => Array.isArray(v));
        if (arr) parsed = arr as GeminiBox2dItem[];
      }
    } catch {
      return [];
    }

    // Converter coordenadas do Tile (0-1000) para coordenadas da Imagem Full (Percentual Total)
    return parsed
      .filter(item => item.box_2d?.length === 4)
      .map(item => {
        const [t_ymin, t_xmin, t_ymax, t_xmax] = item.box_2d;

        // Converter de 0-1000 para pixel no tile
        const px_xmin_tile = (t_xmin / 1000) * tileInfo.width;
        const px_xmax_tile = (t_xmax / 1000) * tileInfo.width;
        const px_ymin_tile = (t_ymin / 1000) * tileInfo.height;
        const px_ymax_tile = (t_ymax / 1000) * tileInfo.height;

        // Adicionar offset do tile para obter pixel na imagem full
        const px_xmin_full = px_xmin_tile + tileInfo.xOff;
        const px_xmax_full = px_xmax_tile + tileInfo.xOff;
        const px_ymin_full = px_ymin_tile + tileInfo.yOff;
        const px_ymax_full = px_ymax_tile + tileInfo.yOff;

        // Converter para percentual da imagem full (0-100)
        const x_min_pct = (px_xmin_full / tileInfo.fullW) * 100;
        const x_max_pct = (px_xmax_full / tileInfo.fullW) * 100;
        const y_min_pct = (px_ymin_full / tileInfo.fullH) * 100;
        const y_max_pct = (px_ymax_full / tileInfo.fullH) * 100;

        // Centro e dimensões finais
        const width_percent = x_max_pct - x_min_pct;
        const height_percent = y_max_pct - y_min_pct;
        const x_percent = x_min_pct + width_percent / 2;
        const y_percent = y_min_pct + height_percent / 2;

        // Raio aproximado em px (apenas referência)
        const radius_px = (width_percent / 100 * tileInfo.fullW) / 2;

        return {
          x_percent,
          y_percent,
          width_percent,
          height_percent,
          radius_px,
          confidence: item.confidence || 0.6,
          tile: tileInfo.name
        };
      });

  } catch (err) {
    console.error(`Error on tile ${tileInfo.name}:`, err);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { frame_base64, expected_count } = await req.json();

    if (!frame_base64) {
      throw new Error('frame_base64 é obrigatório');
    }

    // Configuração Supabase/Gemini
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      const { data } = await supabase.from('embryo_score_secrets').select('key_value').eq('key_name', 'GEMINI_API_KEY').maybeSingle();
      if (data) geminiApiKey = data.key_value;
    }
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY não encontrada');

    // Modelo
    const { data: config } = await supabase.from('embryo_score_config').select('model_name').eq('active', true).maybeSingle();
    const modelName = config?.model_name ?? 'gemini-1.5-pro';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    // 1. Decodificar Imagem
    const imageBytes = Uint8Array.from(atob(frame_base64), c => c.charCodeAt(0));
    const image = await Image.decode(imageBytes);
    const { width, height } = image;

    // 2. Definir Prioridade de Tiles (Hybrid Strategy: Full + Mosaic)
    // Motivo: 
    // - Full Image: Garante a "Macro Visão" e posição correta dos embriões óbvios.
    // - Tiling (Mosaico): Garante o "Micro Detalhe" para embriões pequenos/escondidos.
    // - Combinação: Unimos os dois e o NMS remove as duplicatas.

    let tilesConfig: { name: string, xOff: number, yOff: number, width: number, height: number, fullW: number, fullH: number, b64: string }[] = [];

    // Strategy 1: Always add FULL image (Base Layer)
    const bFull = await image.encodeJPEG(80);
    tilesConfig.push({
      name: 'FULL', xOff: 0, yOff: 0, width: width, height: height, fullW: width, fullH: height,
      b64: btoa(String.fromCharCode(...bFull))
    });

    // Strategy 2: If image is large enough, add Mosaic (Detail Layer)
    // Threshold baixo (800px) para garantir que quase sempre use o mosaico também
    if (width > 800) {
      console.log(`[embryo-detect] Hybrid Mode: Adding 4-tile mosaic for detail (Image width: ${width}).`);
      const overlapX = Math.floor(width * 0.25); // Increased overlap to 25% to avoid edge cuts
      const overlapY = Math.floor(height * 0.25);
      const halfW = Math.floor(width / 2);
      const halfH = Math.floor(height / 2);

      // [x, y, w, h]
      const t1 = image.clone().crop(0, 0, halfW + overlapX, halfH + overlapY);
      const t2 = image.clone().crop(halfW - overlapX, 0, (width - (halfW - overlapX)), halfH + overlapY);
      const t3 = image.clone().crop(0, halfH - overlapY, halfW + overlapX, (height - (halfH - overlapY)));
      const t4 = image.clone().crop(halfW - overlapX, halfH - overlapY, (width - (halfW - overlapX)), (height - (halfH - overlapY)));

      // Encode tiles em paralelo
      const [b1, b2, b3, b4] = await Promise.all([
        t1.encodeJPEG(80), t2.encodeJPEG(80), t3.encodeJPEG(80), t4.encodeJPEG(80)
      ]);

      tilesConfig.push(
        { name: 'TL', xOff: 0, yOff: 0, width: t1.width, height: t1.height, fullW: width, fullH: height, b64: btoa(String.fromCharCode(...b1)) },
        { name: 'TR', xOff: halfW - overlapX, yOff: 0, width: t2.width, height: t2.height, fullW: width, fullH: height, b64: btoa(String.fromCharCode(...b2)) },
        { name: 'BL', xOff: 0, yOff: halfH - overlapY, width: t3.width, height: t3.height, fullW: width, fullH: height, b64: btoa(String.fromCharCode(...b3)) },
        { name: 'BR', xOff: halfW - overlapX, yOff: halfH - overlapY, width: t4.width, height: t4.height, fullW: width, fullH: height, b64: btoa(String.fromCharCode(...b4)) }
      );
    }

    // 3. Executar Detecção (YOLOv8 Local) em Paralelo
    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';

    // Fallback: If not in env, try secrets
    let frameExtractorUrl = FRAME_EXTRACTOR_URL;
    if (!frameExtractorUrl) {
      const { data } = await supabase.from('embryo_score_secrets').select('key_value').eq('key_name', 'FRAME_EXTRACTOR_URL').maybeSingle();
      if (data) frameExtractorUrl = data.key_value;
    }

    if (!frameExtractorUrl) {
      throw new Error('FRAME_EXTRACTOR_URL não configurada');
    }

    // Helper function for YOLO call
    const detectOnTileYolo = async (tile: typeof tilesConfig[0]) => {
      try {
        const resp = await fetch(`${frameExtractorUrl}/detect-yolo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame_base64: tile.b64
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`YOLO API Error on tile ${tile.name}: ${resp.status} - ${errText}`);
          return [];
        }
        const result = await resp.json();
        const preds = result.bboxes || [];

        // Map and Adjust Coordinates to Full Image
        return preds.map((p: any) => {
          // YOLO returns percent of THE TILE
          // p.x_percent, p.y_percent, p.width_percent, p.height_percent are relative to the tile size

          // Convert % of TILE to Pixels in TILE
          const px_x_tile = (p.x_percent / 100) * tile.width;
          const px_y_tile = (p.y_percent / 100) * tile.height;
          const px_w = (p.width_percent / 100) * tile.width;
          const px_h = (p.height_percent / 100) * tile.height;

          // Adjust to Full Image
          const px_x_full = px_x_tile + tile.xOff;
          const px_y_full = px_y_tile + tile.yOff;

          // Convert to % of Full Image
          const x_percent = (px_x_full / tile.fullW) * 100;
          const y_percent = (px_y_full / tile.fullH) * 100;
          const width_percent = (px_w / tile.fullW) * 100;
          const height_percent = (px_h / tile.fullH) * 100;

          return {
            x_percent,
            y_percent,
            width_percent,
            height_percent,
            radius_px: px_w / 2, // approximation
            confidence: p.confidence || 0,
            tile: tile.name
          } as DetectedBbox;
        });
      } catch (e) {
        console.error(`Error YOLO tile ${tile.name}:`, e);
        return [];
      }
    };

    const results = await Promise.all(tilesConfig.map(t => detectOnTileYolo(t)));
    const allBboxes = results.flat();

    // 4. Adaptive Filtering & NMS
    // Strategy:
    // 1. Filter by Aspect Ratio (Broad)
    // 2. NMS (Remove overlaps)
    // 3. Adaptive Threshold based on Expected Count

    // Step 4.1: Aspect Ratio Filter (0.4 - 2.5) => Allow irregular/hatched
    let validCandidates = allBboxes.filter(b => {
      const ratio = b.width_percent / b.height_percent;
      return ratio >= 0.4 && ratio <= 2.5;
    });

    // Step 4.2: NMS Global (0.70 IoU) => Merge only HEAVY overlaps.
    // 0.45 was too aggressive for clustered embryos (center one gets merged into neighbors).
    // 0.70 allows embryos to touch/overlap significantly without disappearing.
    validCandidates = nonMaximumSuppression(validCandidates, 0.70);

    // Step 4.3: Adaptive Selection based on Count
    const minConfidenceFloor = 0.10; // Aggressive floor (10%) to catch everything if count is known
    const defaultConfidence = 0.5;   // Default if no count provided

    let finalBboxes: DetectedBbox[] = [];

    if (expected_count && expected_count > 0) {
      // Prioritize TOP N candidates by Confidence
      validCandidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      // Take top N, but respect floor
      const topCandidates = validCandidates.slice(0, expected_count);
      finalBboxes = topCandidates.filter(b => (b.confidence || 0) >= minConfidenceFloor);

      console.log(`[embryo-detect] Adaptive: Expected ${expected_count}, Found ${finalBboxes.length} (from ${validCandidates.length} candidates)`);
    } else {
      // Standard Filter
      finalBboxes = validCandidates.filter(b => (b.confidence || 0) >= defaultConfidence);
      console.log(`[embryo-detect] Standard: Found ${finalBboxes.length} (Confidence >= ${defaultConfidence})`);
    }

    return new Response(JSON.stringify({
      bboxes: finalBboxes,
      model: modelName,
      debug: {
        strategy: width < 1600 ? 'FULL' : 'TILING_4',
        raw_candidates: validCandidates.length,
        final_count: finalBboxes.length,
        expected_count: expected_count
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(msg);
    return new Response(JSON.stringify({ error: msg, bboxes: [] }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
