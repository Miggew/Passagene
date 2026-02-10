/**
 * Edge Function: embryo-detect
 *
 * Detecta embriões em um frame de estereomicroscópio usando Gemini box_2d.
 * Substitui OpenCV.js HoughCircles — sem dependência de CDN, mais preciso.
 *
 * Recebe: { frame_base64, expected_count, frame_width, frame_height }
 * Retorna: { bboxes: DetectedBbox[], model }
 *
 * Invocação:
 *   supabase.functions.invoke('embryo-detect', { body: { ... } })
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
  box_2d: [number, number, number, number]; // [y_min, x_min, y_max, x_max] normalized 0-1000
  label?: string;
}

// ============================================================
// Handler
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      frame_base64,
      expected_count,
      frame_width,
      frame_height,
    } = body as {
      frame_base64: string;
      expected_count: number;
      frame_width: number;
      frame_height: number;
    };

    if (!frame_base64) {
      return new Response(
        JSON.stringify({ error: 'frame_base64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expected_count || expected_count < 1) {
      return new Response(
        JSON.stringify({ error: 'expected_count deve ser >= 1' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── API Key ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    try {
      const { data: secretRow, error: secretErr } = await supabase
        .from('embryo_score_secrets')
        .select('key_value')
        .eq('key_name', 'GEMINI_API_KEY')
        .maybeSingle();

      if (!secretErr && secretRow?.key_value) {
        geminiApiKey = secretRow.key_value;
      }
    } catch {
      console.warn('embryo_score_secrets: tabela não acessível, usando env var');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    // ── Model config ──
    const { data: config } = await supabase
      .from('embryo_score_config')
      .select('model_name')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const modelName = config?.model_name ?? 'gemini-2.5-flash';

    // ── Gemini call ──
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    // Prompt usando formato oficial da documentação Gemini para box_2d
    const detectionPrompt = `Detect EXACTLY ${expected_count} bovine embryos in this IVF stereomicroscope image.

RULES:
- Return EXACTLY ${expected_count} detections. No more, no less.
- Each detection must have box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000 and label "embryo".
- Embryos are DARK, OPAQUE, circular/oval structures (100-400 μm) sitting ON the culture medium.
- All real embryos in the same plate have SIMILAR sizes (within 2x of each other).

REJECT these (NOT embryos):
- Bubbles: BRIGHT, TRANSPARENT, have light reflections/highlights inside
- Debris: very small irregular fragments, much smaller than embryos
- Well edges: large curved lines at image borders
- Shadows: semi-transparent dark areas without defined borders
- Culture medium droplets: uniform light circles without internal structure

If you see fewer than ${expected_count} clear embryos, return only the ones you are confident about. Do NOT pad with bubbles or debris to reach the count.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    const resp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: frame_base64,
              },
            },
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

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API erro ${resp.status}: ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log(`[embryo-detect] Raw Gemini response: ${raw?.substring(0, 500)}`);

    if (!raw) {
      console.error('[embryo-detect] Full Gemini response:', JSON.stringify(data).substring(0, 1000));
      throw new Error('Gemini não retornou texto na resposta');
    }

    // Parse response — robusto para diversos formatos Gemini
    let json = raw.trim();
    // Remover markdown code blocks se presentes
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';
    console.log(`[embryo-detect] finishReason: ${finishReason}, raw length: ${raw.length}`);

    let parsed: GeminiBox2dItem[];
    try {
      const rawParsed = JSON.parse(json);
      // Gemini pode retornar array direto ou objeto com array dentro
      if (Array.isArray(rawParsed)) {
        parsed = rawParsed;
      } else if (rawParsed && typeof rawParsed === 'object') {
        // Procurar qualquer propriedade que seja um array de objetos com box_2d
        const arrayProp = Object.values(rawParsed).find(
          (v) => Array.isArray(v) && v.length > 0 && v[0]?.box_2d
        ) as GeminiBox2dItem[] | undefined;
        if (arrayProp) {
          parsed = arrayProp;
        } else {
          // Tentar propriedades conhecidas
          parsed = rawParsed.items || rawParsed.embryos || rawParsed.detections || rawParsed.objects || [];
          console.warn('[embryo-detect] Formato inesperado, keys:', Object.keys(rawParsed).join(', '));
        }
      } else {
        parsed = [];
      }
    } catch {
      // JSON.parse falhou — provavelmente resposta truncada pelo Gemini
      console.warn(`[embryo-detect] JSON.parse falhou (finishReason: ${finishReason}, length: ${json.length})`);
      console.warn('[embryo-detect] Last 100 chars:', json.substring(json.length - 100));

      // Fallback 1: Se começa com [ mas não termina com ], tentar fechar o JSON truncado
      if (json.startsWith('[') && !json.trimEnd().endsWith(']')) {
        console.log('[embryo-detect] Tentando recuperar JSON truncado...');
        // Remover item incompleto no final e fechar o array
        const lastCompleteItem = json.lastIndexOf('}');
        if (lastCompleteItem > 0) {
          const repaired = json.substring(0, lastCompleteItem + 1) + ']';
          try {
            const extracted = JSON.parse(repaired);
            parsed = Array.isArray(extracted) ? extracted : [];
            console.log(`[embryo-detect] JSON truncado recuperado: ${parsed.length} items`);
          } catch {
            parsed = [];
            console.error('[embryo-detect] Reparo de JSON truncado falhou');
          }
        } else {
          parsed = [];
        }
      } else {
        // Fallback 2: tentar extrair JSON array do meio do texto
        const arrayMatch = json.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            const extracted = JSON.parse(arrayMatch[0]);
            parsed = Array.isArray(extracted) ? extracted : [];
            console.log(`[embryo-detect] Extraído array com ${parsed.length} items do texto`);
          } catch {
            console.error('[embryo-detect] Fallback extraction também falhou');
            parsed = [];
          }
        } else {
          console.error('[embryo-detect] Nenhum array JSON encontrado na resposta');
          parsed = [];
        }
      }
    }

    // ── Convert box_2d (0-1000) to DetectedBbox (percent 0-100 + radius_px) ──
    const fw = frame_width || 1920;
    const fh = frame_height || 1080;

    const rawBboxes: DetectedBbox[] = parsed
      .filter(item => item.box_2d && Array.isArray(item.box_2d) && item.box_2d.length === 4)
      .map(item => {
        const [y_min, x_min, y_max, x_max] = item.box_2d;

        const x_percent = (x_min + x_max) / 2 / 10;
        const y_percent = (y_min + y_max) / 2 / 10;
        const width_percent = (x_max - x_min) / 10;
        const height_percent = (y_max - y_min) / 10;
        const radius_px = (width_percent / 100 * fw) / 2;

        return {
          x_percent,
          y_percent,
          width_percent,
          height_percent,
          radius_px,
        };
      });

    console.log(`[embryo-detect] ${rawBboxes.length} bboxes brutos de ${parsed.length} items parseados (esperado: ${expected_count})`);

    // ── Filtro 1: Remover outliers de tamanho ──
    // Embriões reais na mesma placa têm tamanho similar.
    // Bboxes muito pequenos (debris) ou muito grandes (well edges) são falsos positivos.
    let bboxes = rawBboxes;

    if (rawBboxes.length > 1) {
      const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
      const sortedAreas = [...areas].sort((a, b) => a - b);
      const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];

      // Aceitar bboxes entre 25% e 400% da área mediana
      const MIN_RATIO = 0.25;
      const MAX_RATIO = 4.0;

      const sizeFiltered = rawBboxes.filter((_, i) => {
        const ratio = areas[i] / medianArea;
        return ratio >= MIN_RATIO && ratio <= MAX_RATIO;
      });

      const removed = rawBboxes.length - sizeFiltered.length;
      if (removed > 0) {
        console.log(`[embryo-detect] Filtro de tamanho: removidos ${removed} outliers (mediana: ${medianArea.toFixed(1)}%, range: ${(medianArea * MIN_RATIO).toFixed(1)}-${(medianArea * MAX_RATIO).toFixed(1)}%)`);
      }
      bboxes = sizeFiltered;
    }

    // ── Filtro 2: Limitar ao expected_count ──
    // Se ainda temos mais bboxes que o esperado, pegar os N com área mais próxima da mediana
    // (embriões reais são os mais "normais" em tamanho; outliers são falsos positivos)
    if (bboxes.length > expected_count) {
      const areas = bboxes.map(b => b.width_percent * b.height_percent);
      const sortedAreas = [...areas].sort((a, b) => a - b);
      const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];

      // Ordenar por distância da mediana (mais próximos primeiro)
      const indexed = bboxes.map((b, i) => ({ bbox: b, dist: Math.abs(areas[i] - medianArea) }));
      indexed.sort((a, b) => a.dist - b.dist);

      const before = bboxes.length;
      bboxes = indexed.slice(0, expected_count).map(item => item.bbox);
      console.log(`[embryo-detect] Limite de contagem: ${before} → ${bboxes.length} (expected_count: ${expected_count}, mediana: ${medianArea.toFixed(1)}%)`);
    }

    console.log(`[embryo-detect] Resultado final: ${bboxes.length} embriões (esperado: ${expected_count}), modelo: ${modelName}`);

    return new Response(
      JSON.stringify({
        bboxes,
        model: modelName,
        debug: {
          raw_length: raw.length,
          raw_snippet: raw.substring(0, 300),
          finish_reason: finishReason,
          parsed_count: parsed.length,
          raw_bbox_count: rawBboxes.length,
          after_size_filter: bboxes.length,
          final_count: bboxes.length,
          expected_count,
          has_box_2d: parsed.length > 0 ? !!parsed[0]?.box_2d : false,
          first_item_keys: parsed.length > 0 ? Object.keys(parsed[0] || {}).join(',') : 'empty',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('embryo-detect error:', errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage, bboxes: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
