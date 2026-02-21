/**
 * Edge Function: report-ocr
 *
 * OCR de relatórios de campo via Gemini 2.0 Flash Vision.
 * Recebe path da imagem no Storage, processa com IA, retorna JSON estruturado.
 *
 * Deploy: supabase functions deploy report-ocr --no-verify-jwt
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
type ReportType = 'p1' | 'p2' | 'te' | 'dg' | 'sexagem' | 'aspiracao';

interface OcrRequest {
  image_path: string;
  report_type: ReportType;
  context: {
    fazenda_id: string;
    protocol_id?: string;
  };
}

interface AnimalRecord {
  id: string;
  registro: string;
  nome?: string;
}

interface CorrectionRecord {
  raw_value: string;
  corrected_value: string;
  field_type: string;
}

// ============================================================
// Prompts por tipo de relatório
// ============================================================

function buildPrompt(
  reportType: ReportType,
  animals: AnimalRecord[],
  corrections: CorrectionRecord[],
): string {
  const animalList = animals.length > 0
    ? `\nANIMAIS CONHECIDOS desta fazenda (use para desambiguar registros escritos à mão):\n${animals.map(a => `- ${a.registro}${a.nome ? ` (${a.nome})` : ''}`).join('\n')}\n`
    : '';

  const correctionList = corrections.length > 0
    ? `\nCORREÇÕES ANTERIORES (a IA errou antes, aprenda com isso):\n${corrections.map(c => `- "${c.raw_value}" na verdade era "${c.corrected_value}" (campo: ${c.field_type})`).join('\n')}\n`
    : '';

  const resultInstructions: Record<ReportType, string> = {
    dg: `Coluna RESULTADO: P = Prenhe, V = Vazia, R = Retoque. Retorne como "P", "V" ou "R".`,
    sexagem: `Coluna RESULTADO: F = Fêmea, M = Macho, S = Sem sexo, D = Dois sexos, V = Vazia. Retorne a letra.`,
    p2: `Coluna RESULTADO: ✓ ou check = Apta, X = Perda. Retorne "APTA" ou "PERDA".`,
    te: `Coluna RESULTADO: código do embrião transferido (texto livre, ex: "EMB-001").`,
    aspiracao: `Este é um relatório de ASPIRAÇÃO FOLICULAR. As colunas numéricas são: ATR (Atrésicos), DEG (Degenerados), EXP (Expandidos), DES (Desnudos), VIA (Viáveis), T (Total). Extraia cada número individualmente.`,
    p1: `Coluna RESULTADO: geralmente vazio no P1 (1º passo). Foque em extrair REGISTRO e RAÇA corretamente.`,
  };

  const basePrompt = `Você é um sistema de OCR especializado em relatórios de campo de reprodução bovina (FIV).

TAREFA: Extrair dados de uma foto de relatório preenchido à mão.

TIPO DE RELATÓRIO: ${reportType.toUpperCase()}
${resultInstructions[reportType]}
${animalList}${correctionList}
INSTRUÇÕES DE OCR:
- Escrita à mão pode ser difícil de ler. Faça seu melhor esforço.
- Registros de animais são códigos como "REC-0235", "DOA-001", etc.
- Se houver ambiguidade, use a lista de animais conhecidos para desambiguar.
- Confidence: 0-100 (100 = certeza absoluta, 0 = chute).
- Se não conseguir ler um campo, retorne string vazia com confidence 0.
- Números de linha (coluna Nº) indicam a ordem.
- Ignore linhas completamente vazias.

RETORNE JSON no formato especificado no response_schema.`;

  return basePrompt;
}

// ============================================================
// Gemini response schema
// ============================================================

function getResponseSchema(reportType: ReportType) {
  if (reportType === 'aspiracao') {
    return {
      type: 'OBJECT',
      properties: {
        header: {
          type: 'OBJECT',
          properties: {
            fazenda: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            data: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            veterinario: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            tecnico: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          },
          required: ['fazenda', 'data', 'veterinario', 'tecnico'],
        },
        rows: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              numero: { type: 'INTEGER' },
              registro: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              raca: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              atresicos: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              degenerados: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              expandidos: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              desnudos: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              viaveis: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
              total: { type: 'OBJECT', properties: { value: { type: 'INTEGER' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            },
            required: ['numero', 'registro', 'raca', 'atresicos', 'degenerados', 'expandidos', 'desnudos', 'viaveis', 'total'],
          },
        },
        pagina: { type: 'STRING', description: 'Número da página se detectado, ex: "1/2"' },
      },
      required: ['header', 'rows'],
    };
  }

  // Schema padrão para relatórios universais (DG, Sexagem, P1, P2, TE)
  return {
    type: 'OBJECT',
    properties: {
      header: {
        type: 'OBJECT',
        properties: {
          fazenda: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          data: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          veterinario: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          tecnico: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          servico_detectado: { type: 'STRING', description: 'Tipo de serviço detectado pelo checkbox marcado: p1, p2, te, dg, sexagem' },
        },
        required: ['fazenda', 'data', 'veterinario', 'tecnico'],
      },
      rows: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            numero: { type: 'INTEGER' },
            registro: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            raca: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            resultado: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
            obs: { type: 'OBJECT', properties: { value: { type: 'STRING' }, confidence: { type: 'INTEGER' } }, required: ['value', 'confidence'] },
          },
          required: ['numero', 'registro', 'raca', 'resultado', 'obs'],
        },
      },
      pagina: { type: 'STRING', description: 'Número da página se detectado, ex: "1/2"' },
    },
    required: ['header', 'rows'],
  };
}

// ============================================================
// Handler principal
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: OcrRequest = await req.json();

    // Validação
    if (!body.image_path || !body.report_type || !body.context?.fazenda_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'image_path, report_type e context.fazenda_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const validTypes: ReportType[] = ['p1', 'p2', 'te', 'dg', 'sexagem', 'aspiracao'];
    if (!validTypes.includes(body.report_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `report_type inválido: ${body.report_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Supabase client (service_role para acessar Storage)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Download imagem do Storage
    console.log(`[report-ocr] Downloading: ${body.image_path}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('report-images')
      .download(body.image_path);

    if (downloadError || !fileData) {
      throw new Error(`Falha ao baixar imagem: ${downloadError?.message || 'dados vazios'}`);
    }

    // Converter para base64 (chunked para não estourar call stack em imagens grandes)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);
    const mimeType = body.image_path.endsWith('.png') ? 'image/png' : 'image/jpeg';

    console.log(`[report-ocr] Image: ${(arrayBuffer.byteLength / 1024).toFixed(0)}KB, type: ${mimeType}`);

    // 2. Buscar Gemini API key
    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    try {
      const { data: secretRow } = await supabase
        .from('embryo_score_secrets')
        .select('key_value')
        .eq('key_name', 'GEMINI_API_KEY')
        .maybeSingle();

      if (secretRow?.key_value) {
        geminiApiKey = secretRow.key_value;
      }
    } catch {
      console.warn('[report-ocr] embryo_score_secrets não acessível, usando env var');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    // 3. Buscar animais da fazenda (para matching)
    let animals: AnimalRecord[] = [];
    const isReceptoraType = ['dg', 'sexagem', 'p1', 'p2', 'te'].includes(body.report_type);

    if (isReceptoraType) {
      const { data: receptoras } = await supabase
        .from('receptoras')
        .select('id, registro, nome')
        .limit(500);
      animals = (receptoras || []) as AnimalRecord[];
    } else {
      // Aspiração — buscar doadoras
      const { data: doadoras } = await supabase
        .from('doadoras')
        .select('id, registro, nome')
        .limit(500);
      animals = (doadoras || []) as AnimalRecord[];
    }

    console.log(`[report-ocr] Animals loaded: ${animals.length}`);

    // 4. Buscar correções recentes
    let corrections: CorrectionRecord[] = [];
    try {
      const { data: corrData } = await supabase
        .from('ocr_corrections')
        .select('raw_value, corrected_value, field_type')
        .eq('fazenda_id', body.context.fazenda_id)
        .eq('report_type', body.report_type)
        .order('created_at', { ascending: false })
        .limit(20);

      corrections = (corrData || []) as CorrectionRecord[];
    } catch {
      console.warn('[report-ocr] ocr_corrections não acessível');
    }

    // 5. Montar prompt
    const prompt = buildPrompt(body.report_type, animals, corrections);

    // 6. Chamar Gemini 2.0 Flash Vision
    const modelName = 'gemini-2.0-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s timeout

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: prompt }],
        },
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            {
              text: 'Extraia todos os dados desta foto de relatório de campo. Retorne no formato JSON especificado.',
            },
          ],
        }],
        generation_config: {
          temperature: 0.1,
          max_output_tokens: 8192,
          response_mime_type: 'application/json',
          response_schema: getResponseSchema(body.report_type),
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini API erro (${geminiResp.status}): ${errText.substring(0, 500)}`);
    }

    const geminiData = await geminiResp.json();
    const candidate = geminiData?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;

    console.log(`[report-ocr] finishReason=${finishReason}, rawLen=${rawText?.length || 0}`);

    if (!rawText) {
      throw new Error(`Gemini resposta vazia (finishReason: ${finishReason})`);
    }

    // 7. Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Falha ao parsear JSON do Gemini: ${rawText.substring(0, 200)}`);
    }

    // 8. Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        data: parsed,
        metadata: {
          model: modelName,
          finish_reason: finishReason,
          animals_loaded: animals.length,
          corrections_loaded: corrections.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[report-ocr] error:', message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
