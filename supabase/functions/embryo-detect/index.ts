/**
 * Edge Function: embryo-detect
 *
 * Detecta embriões em um frame de estereomicroscópio usando Gemini box_2d.
 * Integrado com OpenCV HoughCircles para validação híbrida.
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
  geometric_support?: boolean;
  texture_score?: number;
}

interface GeminiBox2dItem {
  box_2d: [number, number, number, number];
  label?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { frame_base64, expected_count, frame_width, frame_height } = body;

    if (!frame_base64) throw new Error('frame_base64 missing');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!!);
    
    // 1. Chave Gemini e Config
    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const { data: secretRow } = await supabase.from('embryo_score_secrets').select('key_value').eq('key_name', 'GEMINI_API_KEY').maybeSingle();
    if (secretRow?.key_value) geminiApiKey = secretRow.key_value;

    const { data: config } = await supabase.from('embryo_score_config').select('model_name').eq('active', true).maybeSingle();
    const modelName = config?.model_name ?? 'gemini-2.5-flash';

    // 2. Detecção OpenCV (Geométrica)
    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';
    let opencvCircles: any[] = [];
    if (FRAME_EXTRACTOR_URL) {
      try {
        const cvResp = await fetch(`${FRAME_EXTRACTOR_URL}/detect-circles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame_base64 }),
        });
        if (cvResp.ok) {
          const cvData = await cvResp.json();
          opencvCircles = cvData.circles || [];
        }
      } catch (err) { console.warn('OpenCV Detect failed', err); }
    }

    // 3. Detecção Gemini (Semântica D7/D8)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const detectionPrompt = `Analyze this stereomicroscope image. Identify VALID Bovine Blastocysts (Day 7/8).
STRICT BIOLOGICAL IDENTIFIERS:
1. Inner Cell Mass (ICM): A dense, granular cluster of cells inside.
2. Trophectoderm (TE): A thin layer of cells forming the sphere.
3. Blastocoel: A clear cavity inside.

STRICT EXCLUSION:
- BUBBLES: Perfectly circular, bright centers, thick black borders, NO cellular texture.
- DEBRIS: Small dark specks.
- SHADOWS: Large patches near edges.

There are UP TO ${expected_count || 10} embryos in this image. Return bounding boxes [ymin, xmin, ymax, xmax] in JSON ONLY for clear, undeniable embryos (spherical morulas or blastocysts). It is STRICTLY FORBIDDEN to flag air bubbles, debris, or empty fluid just to meet the expected count. Precision is paramount. It is perfectly acceptable and expected to return fewer boxes than ${expected_count || 10} if the structures are not unambiguously clear.`;

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: frame_base64 } }, { text: detectionPrompt }] }],
        generation_config: { temperature: 0, response_mime_type: 'application/json' }
      }),
    });

    const geminiData = await geminiResp.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    let parsed: any[] = [];
    try {
        const json = JSON.parse(rawText.replace(/```json|```/g, ''));
        parsed = Array.isArray(json) ? json : (json.items || json.embryos || []);
    } catch { parsed = []; }

    const fw = frame_width || 1920;
    const fh = frame_height || 1080;

    // 4. Conversão e Validação Híbrida
    const rawBboxes: DetectedBbox[] = parsed.filter(i => i.box_2d).map(item => {
      const [y_min, x_min, y_max, x_max] = item.box_2d;
      const x_percent = (x_min + x_max) / 2 / 10;
      const y_percent = (y_min + y_max) / 2 / 10;
      const width_percent = (x_max - x_min) / 10;
      const height_percent = (y_max - y_min) / 10;
      const radius_px = (width_percent / 100 * fw) / 2;

      // Buscar suporte no OpenCV
      const support = opencvCircles.find(c => {
        const dist = Math.sqrt(Math.pow(c.x - (x_percent/100*fw), 2) + Math.pow(c.y - (y_percent/100*fh), 2));
        return dist < radius_px * 1.5;
      });

      return {
        x_percent, y_percent, width_percent, height_percent, radius_px,
        geometric_support: !!support,
        texture_score: support ? support.texture_score : 0
      };
    });

    // Filtro Final: Só aceita se houver suporte geométrico OU se for uma detecção muito grande/clara do Gemini
    let finalBboxes = rawBboxes.filter(b => b.geometric_support || b.width_percent > 5);

    // Limitar ao esperado
    if (finalBboxes.length > expected_count) {
        finalBboxes = finalBboxes.slice(0, expected_count);
    }

    return new Response(JSON.stringify({ bboxes: finalBboxes }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, bboxes: [] }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
