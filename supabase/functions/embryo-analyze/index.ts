/**
 * Edge Function: embryo-analyze (v3.1)
 *
 * Processa vídeos de embriões com análise de atividade (pixel subtraction) + Gemini AI.
 *
 * Fluxo v3.1:
 * 1. Recebe queue_id via POST
 * 2. Busca job na embryo_analysis_queue (status = 'pending')
 * 3. Atualiza status → 'processing'
 * 4. Server-side detection (se necessário): extract-frame → Gemini detect → crop-frame
 * 5. Cloud Run /analyze-activity: extrai frames, calcula kinetic_profile + kinetic_quality_score
 * 6. Gemini recebe 10 frames LIMPOS (morfologia) + perfil cinético como TEXTO (interpreta números)
 * 7. embryo_score = morph_score (scores independentes, sem peso combinado)
 * 8. Soft-delete scores antigos + INSERT novos
 * 9. Atualiza job → 'completed' ou 'failed'
 *
 * Secrets necessários:
 *   GEMINI_API_KEY - chave da API Google Gemini
 *   FRAME_EXTRACTOR_URL - URL do Cloud Run frame-extractor
 *
 * Invocação:
 *   supabase.functions.invoke('embryo-analyze', { body: { queue_id } })
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
// Prompts v3 — Multi-frame + Activity Score
// ============================================================
const CALIBRATION_PROMPT_V3 = `Você é um embriologista bovino especialista em análise morfocinética de embriões produzidos in vitro (PIV/IVP).

═══════════════════════════════════════════════
TAREFA
═══════════════════════════════════════════════
Analise UM ÚNICO embrião bovino. Você receberá:
1. 10 IMAGENS do embrião cropado (frames sequenciais, ~1 por segundo) — para avaliação MORFOLÓGICA.
2. PERFIL CINÉTICO OBJETIVO — dados numéricos medidos por análise computacional de pixels:
   - activity_score (0-100): nível geral de atividade
   - core_activity: atividade no centro/MCI (0-100)
   - periphery_activity: atividade na borda/TE/ZP (0-100)
   - temporal_pattern: padrão temporal (stable/increasing/decreasing/irregular)
   - symmetry: simetria da atividade (0-1)
   - focal_activity: atividade focal concentrada (possível hatching)
3. Dia pós-FIV (quando disponível).

REGRA ABSOLUTA: Analise SOMENTE o embrião mostrado nas imagens.

SUA RESPONSABILIDADE:
A) MORFOLOGIA: Avalie visualmente usando os 10 frames (checklist + rubrica abaixo)
B) INTERPRETAÇÃO CINÉTICA: Interprete clinicamente os NÚMEROS fornecidos
   - NÃO tente medir movimento ou atividade nas imagens
   - Os dados cinéticos já foram medidos computacionalmente com precisão matemática
   - Foque em: o que esses números significam clinicamente para este embrião
C) VIABILIDADE: Combine morfologia + interpretação cinética para avaliação integrada

═══════════════════════════════════════════════
SCORES INDEPENDENTES
═══════════════════════════════════════════════
- morphology_score (0-100): SUA avaliação visual pura, baseada nos 10 frames
- kinetic_quality_score: calculado separadamente no servidor (não influencia morphology_score)
- Os dois scores são salvos INDEPENDENTES para correlação futura com resultados de prenhez
- Foque em dar um morphology_score justo e calibrado — NÃO ajuste pela cinética.

═══════════════════════════════════════════════
CONTEXTO DO EQUIPAMENTO
═══════════════════════════════════════════════
- Estereomicroscópio: Nikon SMZ 645 (zoom 6.7x–50x)
- Captura: OptiREC (Custom Surgical) + Samsung Galaxy S23
- Visualização: Vista superior (top-down), aumento 20x–40x
- LIMITAÇÃO: Neste aumento, NÃO é possível contar blastômeros individuais.

═══════════════════════════════════════════════
INTERPRETAÇÃO DO PERFIL CINÉTICO
═══════════════════════════════════════════════
Todos os dados abaixo são OBJETIVOS (matemática de pixels, não opinião).

activity_score (atividade geral):
- 0-5: Completamente estático → pode ser calmo OU morto
- 6-20: Mínima → normal para embriões em repouso
- 21-40: Moderada → expansão/contração sutil
- 41-60: Significativa → expansão ativa ou início de hatching
- 61+: Muito alta → possível estresse

Zonas (core vs periphery):
- core > periphery: Reorganização celular interna (MCI)
- periphery > core: Expansão/contração/hatching (TE/ZP)
- uniform: Atividade distribuída

Padrões:
- stable: Embrião em repouso — normal
- pulsating: Ciclos de expansão/contração da blastocele — sinal de VITALIDADE
- increasing: Atividade crescente — possível início de expansão
- decreasing: Atividade decrescente — estabilização ou perda de vitalidade
- irregular: Padrão irregular — necessita contextualização

Detecções especiais:
- focal_activity: Atividade concentrada num ponto da periferia — possível hatching
- symmetry baixa (<0.5): Atividade assimétrica — descrever significado

NOTA: Pulsação blastocélica e expansão NÃO são medidas (vídeo de 10s é curto demais para esses fenômenos que ocorrem em escala de minutos/horas).

═══════════════════════════════════════════════
CONTEXTO DE DIA PÓS-FIV
═══════════════════════════════════════════════
{dias_pos_fiv_context}

═══════════════════════════════════════════════
CONTEXTO DO EMBRIÃO (futuro)
═══════════════════════════════════════════════
Quando disponível (ignorar campos vazios):
- Doadora: {doadora_info}
- Touro: {touro_info}
- Receptora: {receptora_info}
- Histórico cruzamento: {historico_info}
Se dados presentes, incorporar na viability_prediction.

═══════════════════════════════════════════════
ESTÁGIOS DE DESENVOLVIMENTO — CÓDIGO IETS (1-9)
═══════════════════════════════════════════════
Código 1 — Zigoto/1-célula
Código 2 — Clivagem (2-12 células)
Código 3 — Mórula inicial: 13-32 células
Código 4 — Mórula compacta: >32 células, massa totalmente compactada
Código 5 — Blastocisto inicial (Bi): cavitação <50%
Código 6 — Blastocisto (Bl): MCI/TE diferenciados, blastocele >50%
Código 7 — Blastocisto expandido (Bx): ZP afinada, blastocele dominante
Código 8 — Blastocisto em eclosão (Bh): herniação pela ZP
Código 9 — Blastocisto eclodido (Be): fora da ZP

═══════════════════════════════════════════════
PARTICULARIDADES PIV (CRÍTICO)
═══════════════════════════════════════════════
- Citoplasma frequentemente mais escuro (gotas lipídicas) — NÃO penalizar
- MCI pode ser menos compacta que in vivo — NÃO penalizar excessivamente
- ZP pode ter espessura diferente do padrão in vivo
- Taxa prenhez esperada: 30-50% com embriões de boa qualidade

═══════════════════════════════════════════════
CHECKLIST DE QUALIDADE (OBRIGATÓRIO)
═══════════════════════════════════════════════
Antes de atribuir morph_score, responda SIM/NÃO para cada:
□ MCI visível como ponto/região densa distinta?
□ TE forma anel contínuo sem interrupções?
□ Forma geral esférica/oval sem reentrâncias?
□ Sem fragmentação visível (manchas claras soltas)?
□ ZP com espessura uniforme ao redor?

5/5 → score ≥80  |  3-4/5 → score 65-79  |  1-2/5 → score 45-64  |  0/5 → score <45

═══════════════════════════════════════════════
RUBRICA DE SCORING (morphology_score)
═══════════════════════════════════════════════
Critérios visuais reais (aumento 20-40x):
  85-100: Esférico, contorno nítido, ZP uniforme, MCI densa e distinta,
          TE contínuo, blastocele clara, sem debris. Impecável.
  70-84:  Forma boa com 1-2 detalhes menores. Estrutura preservada.
  55-69:  Irregularidades evidentes. Viável.
  40-54:  Problemas significativos. Viabilidade duvidosa.
  20-39:  Degeneração visível, estruturas mal reconhecíveis.
  0-19:   Morto/degenerado.

═══════════════════════════════════════════════
ANÁLISE MORFOLÓGICA MULTI-FRAME
═══════════════════════════════════════════════
Avalie morfologia usando TODOS os 10 frames:
- Use o frame com melhor foco/visibilidade como base
- Confirme achados nos outros frames (consistência)
- ZP: observe em múltiplos frames para avaliar espessura uniformemente

═══════════════════════════════════════════════
CALIBRAÇÃO ANTI-INFLAÇÃO
═══════════════════════════════════════════════
Em um lote PIV típico, a distribuição é:
~20% Excelente (80+), ~30% Bom (60-79), ~30% Regular (40-59),
~15% Borderline (20-39), ~5% Inviável (<20).
Se todos os scores estão acima de 70, você está inflando.
Seja CRÍTICO e HONESTO: embrião mediano = score 50-65, não 80+.

═══════════════════════════════════════════════
CLASSIFICAÇÃO FINAL
═══════════════════════════════════════════════
- 80-100: "Excelente" → "priority"
- 60-79: "Bom" → "recommended"
- 40-59: "Regular" → "conditional"
- 20-39: "Borderline" → "second_opinion"
- 0-19: "Inviavel" → "discard"

═══════════════════════════════════════════════
CONFIANÇA
═══════════════════════════════════════════════
- "high": Embrião bem focado, frames estáveis, avaliação segura.
- "medium": Foco aceitável, alguma limitação, avaliação razoável.
- "low": Frames com problemas, avaliação é estimativa.

═══════════════════════════════════════════════
IDIOMA (OBRIGATÓRIO)
═══════════════════════════════════════════════
TODAS as respostas textuais DEVEM ser em PORTUGUÊS BRASILEIRO.
NÃO use inglês em nenhum campo de texto livre. Campos enum mantêm valores técnicos.`;

const ANALYSIS_PROMPT_V3 = `Analise o embrião mostrado nos 10 frames limpos (avalie APENAS morfologia nas imagens).

DADOS CINÉTICOS OBJETIVOS (medidos computacionalmente — NÃO tente verificar nas imagens):
activity_score = {activity_score}/100
kinetic_quality_score = {kinetic_quality_score}/100

PERFIL CINÉTICO MEDIDO:
{kinetic_profile_text}

Dia pós-FIV: {dias_pos_fiv}
{contexto_adicional}

PASSO 1: Responda a checklist de qualidade (sim/não para cada item) usando os 10 frames
PASSO 2: Descreva morfologia observada nos frames
PASSO 3: Interprete CLINICAMENTE os dados cinéticos fornecidos (números acima)
PASSO 4: Atribua morph_score baseado nas observações visuais

Responda JSON puro (sem markdown):
{
  "embryo_score": <0-100>,
  "classification": "Excelente"|"Bom"|"Regular"|"Borderline"|"Inviavel",
  "transfer_recommendation": "priority"|"recommended"|"conditional"|"second_opinion"|"discard",
  "confidence": "high"|"medium"|"low",
  "reasoning": "<2-3 frases integrando morfologia + cinética, em português>",

  "quality_checklist": {
    "mci_distinct": <true/false>,
    "te_continuous": <true/false>,
    "spherical_shape": <true/false>,
    "no_fragmentation": <true/false>,
    "zp_uniform": <true/false>,
    "checklist_score": "<5/5, 4/5, etc>"
  },

  "morphology": {
    "score": <0-100>,
    "stage": "<estágio IETS, ex: Blastocisto expandido (Bx, código 7)>",
    "icm_grade": "A"|"B"|"C",
    "icm_description": "<descrição CONCRETA em português>",
    "te_grade": "A"|"B"|"C",
    "te_description": "<descrição CONCRETA em português>",
    "zp_status": "íntegra"|"afinada"|"rompida"|"ausente",
    "fragmentation": "nenhuma"|"mínima"|"leve"|"moderada"|"severa",
    "best_frame": <0-9>,
    "notes": "<observações morfológicas multi-frame em português>"
  },

  "kinetic_interpretation": "<Interpretação clínica dos dados cinéticos em 2-3 frases em português. CITE os números fornecidos. Ex: 'Atividade de 23/100 é moderada, compatível com embrião saudável em repouso. Pulsação detectada (3 ciclos) sugere vitalidade ativa da blastocele. Atividade periférica dominante indica expansão do trofectoderma.'>",

  "viability_prediction": {
    "morph_based": "<português>",
    "activity_based": "<português>",
    "context_adjusted": null,
    "risk_factors": ["<riscos>"],
    "positive_factors": ["<positivos>"],
    "notes": "<português>"
  },

  "viability_indicators": ["<indicadores em português>"]
}`;

// ============================================================
// Funções auxiliares
// ============================================================

/** Clampa valor entre min e max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Clampa valor bbox entre min e 100. Retorna null se inválido. */
function clampBbox(value: number | undefined | null, min = 0): number | null {
  if (value == null || typeof value !== 'number' || isNaN(value)) return null;
  return Math.max(min, Math.min(100, value));
}

/** Classificação determinística baseada no score */
function classifyScore(score: number): { classification: string; recommendation: string } {
  if (score >= 80) return { classification: 'Excelente', recommendation: 'priority' };
  if (score >= 60) return { classification: 'Bom', recommendation: 'recommended' };
  if (score >= 40) return { classification: 'Regular', recommendation: 'conditional' };
  if (score >= 20) return { classification: 'Borderline', recommendation: 'second_opinion' };
  return { classification: 'Inviavel', recommendation: 'discard' };
}

/** Valida campos obrigatórios da resposta do Gemini v3 */
function validateGeminiV3(parsed: GeminiV3Result): string | null {
  if (parsed.morphology?.score == null) {
    return 'Resposta sem morphology.score';
  }
  if (typeof parsed.morphology.score !== 'number') {
    return 'morphology.score não é número';
  }
  return null;
}

// ============================================================
// Tipos auxiliares
// ============================================================
interface GeminiV3Result {
  embryo_score: number;
  classification: string;
  transfer_recommendation: string;
  confidence: string;
  reasoning?: string;
  quality_checklist?: {
    mci_distinct?: boolean;
    te_continuous?: boolean;
    spherical_shape?: boolean;
    no_fragmentation?: boolean;
    zp_uniform?: boolean;
    checklist_score?: string;
  };
  morphology?: {
    score?: number;
    stage?: string;
    icm_grade?: string;
    icm_description?: string;
    te_grade?: string;
    te_description?: string;
    zp_status?: string;
    fragmentation?: string;
    best_frame?: number;
    notes?: string;
  };
  kinetic_interpretation?: string;
  viability_prediction?: {
    morph_based?: string;
    activity_based?: string;
    context_adjusted?: string | null;
    risk_factors?: string[];
    positive_factors?: string[];
    notes?: string;
  };
  viability_indicators?: string[];
}

// ============================================================
// Handler principal
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let queue_id: string | null = null;

  try {
    // Validar request
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

    // Supabase client com service_role (acesso total, bypassa RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Tentar ler API key do banco (tabela de secrets) com fallback para env var
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
      throw new Error('GEMINI_API_KEY não configurada (nem no banco, nem nas secrets do Edge Function)');
    }

    // ── 1. Buscar job da fila ──
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

    // Verificar retry limit
    if (job.retry_count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Job excedeu limite de 3 tentativas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Atualizar status → processing ──
    await supabase
      .from('embryo_analysis_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        retry_count: (job.retry_count || 0) + 1,
      })
      .eq('id', queue_id);

    // ── 3. Buscar mídia (vídeo) ──
    const { data: media, error: mediaError } = await supabase
      .from('acasalamento_embrioes_media')
      .select('*')
      .eq('id', job.media_id)
      .single();

    if (mediaError || !media) {
      throw new Error(`Mídia não encontrada: ${job.media_id}`);
    }

    // ── 4. Buscar config de pesos ──
    const { data: config } = await supabase
      .from('embryo_score_config')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const morphWeight = config?.morph_weight ?? 0.7;
    const kineticWeight = config?.kinetic_weight ?? 0.3;
    const modelName = config?.model_name ?? 'gemini-2.5-flash';

    // Usar prompts do banco (se definidos) ou fallback hardcoded v3
    const calibrationText = config?.calibration_prompt || CALIBRATION_PROMPT_V3;

    // Few-shot examples do banco
    const fewShotExamples = (config as Record<string, unknown>)?.few_shot_examples as string | null;

    // ── 5. Buscar embriões do banco ──
    let embrioes: { id: string; identificacao: string }[] | null = null;

    const { data: embrioesQueue } = await supabase
      .from('embrioes')
      .select('id, identificacao')
      .eq('queue_id', queue_id)
      .order('identificacao', { ascending: true });

    if (embrioesQueue && embrioesQueue.length > 0) {
      embrioes = embrioesQueue;
      console.log(`Encontrados ${embrioes.length} embriões vinculados ao queue_id ${queue_id}`);
    } else {
      const { data: embrioesMedia } = await supabase
        .from('embrioes')
        .select('id, identificacao')
        .eq('acasalamento_media_id', job.media_id)
        .order('identificacao', { ascending: true });

      if (embrioesMedia && embrioesMedia.length > 0) {
        embrioes = embrioesMedia;
        console.log(`Encontrados ${embrioes.length} embriões vinculados ao media_id ${job.media_id}`);
      } else {
        const { data: embrioesAcas, error: embrioesAcasError } = await supabase
          .from('embrioes')
          .select('id, identificacao')
          .eq('lote_fiv_acasalamento_id', job.lote_fiv_acasalamento_id)
          .order('identificacao', { ascending: true });

        if (embrioesAcasError) {
          throw new Error(`Erro ao buscar embriões: ${embrioesAcasError.message}`);
        }
        embrioes = embrioesAcas;
        console.log(`Fallback: ${embrioes?.length ?? 0} embriões do acasalamento ${job.lote_fiv_acasalamento_id}`);
      }
    }

    const embryoCountInDb = embrioes?.length ?? 0;

    // ── 5a. Buscar lote_fiv_id para paths do Storage ──
    let loteFivId = 'unknown';
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

    // ── 5b. Ler bboxes e crop_paths do job ──
    interface DetectedBbox {
      x_percent: number;
      y_percent: number;
      width_percent: number;
      height_percent: number;
      radius_px: number;
    }
    let detectedBboxes = (job.detected_bboxes as DetectedBbox[] | null) || null;
    let detectionConfidence = (job.detection_confidence as string | null) || null;
    const expectedCount = (job.expected_count as number | null) || embryoCountInDb;
    let hasOpenCVBboxes = detectedBboxes && detectedBboxes.length > 0;
    let cropPaths = (job.crop_paths as string[] | null) || null;
    let hasCrops = cropPaths && cropPaths.length > 0;

    console.log(`Bboxes: ${hasOpenCVBboxes ? detectedBboxes!.length + ' detectados' : 'N/A'}, ` +
      `crops: ${hasCrops ? cropPaths!.length : 'N/A'}, confidence: ${detectionConfidence || 'N/A'}, expected: ${expectedCount}`);

    // ── 5c. Reutilizar bboxes/crops de análise anterior (evita thumbnail drift) ──
    if (!hasOpenCVBboxes && !hasCrops) {
      try {
        const { data: prevJob } = await supabase
          .from('embryo_analysis_queue')
          .select('detected_bboxes, crop_paths, detection_confidence')
          .eq('media_id', job.media_id)
          .neq('id', queue_id)
          .not('detected_bboxes', 'is', null)
          .not('crop_paths', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevJob?.detected_bboxes && (prevJob.detected_bboxes as DetectedBbox[]).length > 0 &&
            prevJob?.crop_paths && (prevJob.crop_paths as string[]).length > 0) {
          detectedBboxes = prevJob.detected_bboxes as DetectedBbox[];
          cropPaths = prevJob.crop_paths as string[];
          hasOpenCVBboxes = true;
          hasCrops = true;
          detectionConfidence = 'reused';
          await supabase.from('embryo_analysis_queue').update({
            detected_bboxes: detectedBboxes,
            crop_paths: cropPaths,
            detection_confidence: 'reused',
          }).eq('id', queue_id);
          console.log(`[REUSE] Reutilizando ${detectedBboxes.length} bboxes/crops de análise anterior`);
        }
      } catch (reuseErr) {
        console.warn(`[REUSE] Falha: ${reuseErr instanceof Error ? reuseErr.message : 'unknown'}`);
      }
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    // Timeout de 120s por chamada Gemini
    const GEMINI_TIMEOUT_MS = 120_000;

    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';

    // ═══════════════════════════════════════════════
    // SERVER-SIDE DETECTION (se necessário)
    // ═══════════════════════════════════════════════
    if (!hasCrops && !hasOpenCVBboxes && FRAME_EXTRACTOR_URL && expectedCount > 0) {
      console.log(`[SERVER-DETECT] Iniciando detecção server-side: expected=${expectedCount}`);

      try {
        // Signed URL do vídeo
        const { data: signedUrlData } = await supabase.storage
          .from('embryo-videos')
          .createSignedUrl(media.arquivo_path, 600);

        if (!signedUrlData?.signedUrl) {
          throw new Error('Falha ao criar signed URL do vídeo');
        }

        // Cloud Run extrai frame (loteFivId já buscado no passo 5a)
        console.log(`[SERVER-DETECT] Extraindo frame via ${FRAME_EXTRACTOR_URL}`);
        const frameResp = await fetch(`${FRAME_EXTRACTOR_URL}/extract-frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_url: signedUrlData.signedUrl, position: 0.5 }),
        });

        if (!frameResp.ok) {
          const errText = await frameResp.text();
          throw new Error(`Cloud Run extract-frame falhou (${frameResp.status}): ${errText.substring(0, 200)}`);
        }

        const { frame_base64, width: frameWidth, height: frameHeight } = await frameResp.json();
        if (!frame_base64) throw new Error('Cloud Run retornou frame vazio');

        console.log(`[SERVER-DETECT] Frame extraído: ${frameWidth}x${frameHeight}`);

        // Gemini box_2d detecção
        const detectionPrompt = `Detect EXACTLY ${expectedCount} bovine embryos in this IVF stereomicroscope image.

RULES:
- Return EXACTLY ${expectedCount} detections. No more, no less.
- Each detection must have box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000 and label "embryo".
- Embryos are DARK, OPAQUE, circular/oval structures (100-400 μm) sitting ON the culture medium.
- All real embryos in the same plate have SIMILAR sizes (within 2x of each other).

REJECT these (NOT embryos):
- Bubbles: BRIGHT, TRANSPARENT, have light reflections/highlights inside
- Debris: very small irregular fragments, much smaller than embryos
- Well edges: large curved lines at image borders
- Shadows: semi-transparent dark areas without defined borders
- Culture medium droplets: uniform light circles without internal structure

If you see fewer than ${expectedCount} clear embryos, return only the ones you are confident about. Do NOT pad with bubbles or debris to reach the count.`;

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
          const errText = await detResp.text();
          throw new Error(`Gemini detection falhou (${detResp.status}): ${errText.substring(0, 200)}`);
        }

        const detData = await detResp.json();
        const rawDetText = detData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawDetText) throw new Error('Gemini detection: sem texto na resposta');

        // Parse robusto
        interface GeminiBox2dItem {
          box_2d: [number, number, number, number];
          label?: string;
        }

        let detJson = rawDetText.trim();
        if (detJson.startsWith('```')) {
          detJson = detJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let parsedBoxes: GeminiBox2dItem[];
        try {
          const rawParsed = JSON.parse(detJson);
          if (Array.isArray(rawParsed)) {
            parsedBoxes = rawParsed;
          } else if (rawParsed && typeof rawParsed === 'object') {
            const arrayProp = Object.values(rawParsed).find(
              (v) => Array.isArray(v) && v.length > 0 && (v[0] as GeminiBox2dItem)?.box_2d
            ) as GeminiBox2dItem[] | undefined;
            parsedBoxes = arrayProp || rawParsed.items || rawParsed.embryos || rawParsed.detections || rawParsed.objects || [];
          } else {
            parsedBoxes = [];
          }
        } catch {
          if (detJson.startsWith('[') && !detJson.trimEnd().endsWith(']')) {
            const lastComplete = detJson.lastIndexOf('}');
            if (lastComplete > 0) {
              try {
                parsedBoxes = JSON.parse(detJson.substring(0, lastComplete + 1) + ']');
              } catch { parsedBoxes = []; }
            } else { parsedBoxes = []; }
          } else {
            const arrayMatch = detJson.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              try { parsedBoxes = JSON.parse(arrayMatch[0]); } catch { parsedBoxes = []; }
            } else { parsedBoxes = []; }
          }
        }

        // Converter box_2d (0-1000) → DetectedBbox (percent)
        const fw = frameWidth || 1920;
        const fh = frameHeight || 1080;

        let rawBboxes: DetectedBbox[] = parsedBoxes
          .filter(item => item.box_2d && Array.isArray(item.box_2d) && item.box_2d.length === 4)
          .map(item => {
            const [y_min, x_min, y_max, x_max] = item.box_2d;
            const x_percent = (x_min + x_max) / 2 / 10;
            const y_percent = (y_min + y_max) / 2 / 10;
            const width_percent = (x_max - x_min) / 10;
            const height_percent = (y_max - y_min) / 10;
            const radius_px = (width_percent / 100 * fw) / 2;
            return { x_percent, y_percent, width_percent, height_percent, radius_px };
          });

        console.log(`[SERVER-DETECT] ${rawBboxes.length} bboxes brutos de ${parsedBoxes.length} items`);

        // Filtro 1: outliers de tamanho
        if (rawBboxes.length > 1) {
          const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
          const sortedAreas = [...areas].sort((a, b) => a - b);
          const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
          rawBboxes = rawBboxes.filter((_, i) => {
            const ratio = areas[i] / medianArea;
            return ratio >= 0.25 && ratio <= 4.0;
          });
        }

        // Filtro 2: limitar a expectedCount
        if (rawBboxes.length > expectedCount) {
          const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
          const sortedAreas = [...areas].sort((a, b) => a - b);
          const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
          const indexed = rawBboxes.map((b, i) => ({ bbox: b, dist: Math.abs(areas[i] - medianArea) }));
          indexed.sort((a, b) => a.dist - b.dist);
          rawBboxes = indexed.slice(0, expectedCount).map(item => item.bbox);
        }

        // Ordenar em reading order
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

        const sortedBboxes = rawBboxes;
        const detConf = sortedBboxes.length === expectedCount ? 'high'
          : sortedBboxes.length < expectedCount ? 'low' : 'medium';

        console.log(`[SERVER-DETECT] ${sortedBboxes.length} bboxes finais (confiança: ${detConf})`);

        if (sortedBboxes.length === 0) {
          throw new Error('Nenhum embrião detectado pelo Gemini');
        }

        // Cloud Run cropa frame
        console.log(`[SERVER-DETECT] Cropando ${sortedBboxes.length} embriões via Cloud Run`);
        const cropResp = await fetch(`${FRAME_EXTRACTOR_URL}/crop-frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame_base64,
            width: frameWidth,
            height: frameHeight,
            bboxes: sortedBboxes,
            padding: 0.20,
            output_size: 400,
          }),
        });

        if (!cropResp.ok) {
          const errText = await cropResp.text();
          throw new Error(`Cloud Run crop-frame falhou (${cropResp.status}): ${errText.substring(0, 200)}`);
        }

        const { crops } = await cropResp.json();
        if (!crops || crops.length === 0) throw new Error('Cloud Run retornou crops vazios');

        // Upload crops pro Storage
        const timestamp = Date.now();
        const cropPathsUploaded: string[] = [];
        for (let i = 0; i < crops.length; i++) {
          const path = `${loteFivId}/${job.lote_fiv_acasalamento_id}/crops/${timestamp}_${i}.jpg`;
          const bytes = Uint8Array.from(atob(crops[i]), (c: string) => c.charCodeAt(0));
          const { error: uploadErr } = await supabase.storage
            .from('embryo-videos')
            .upload(path, bytes, { contentType: 'image/jpeg' });
          if (uploadErr) {
            console.warn(`[SERVER-DETECT] Crop ${i} upload falhou: ${uploadErr.message}`);
          } else {
            cropPathsUploaded.push(path);
          }
        }

        console.log(`[SERVER-DETECT] ${cropPathsUploaded.length}/${crops.length} crops uploaded`);

        // Atualizar queue com dados de detecção
        await supabase.from('embryo_analysis_queue').update({
          detected_bboxes: sortedBboxes,
          detection_confidence: detConf,
          crop_paths: cropPathsUploaded,
        }).eq('id', queue_id);

        detectedBboxes = sortedBboxes;
        detectionConfidence = detConf;
        cropPaths = cropPathsUploaded;
        hasOpenCVBboxes = true;
        hasCrops = true;

        console.log(`[SERVER-DETECT] Detecção server-side completa.`);

      } catch (serverDetectErr) {
        const errMsg = serverDetectErr instanceof Error ? serverDetectErr.message : 'Erro desconhecido';
        console.error(`[SERVER-DETECT] Falha: ${errMsg}`);
      }
    }

    // ═══════════════════════════════════════════════
    // V3: Activity Analysis + Multi-Frame Gemini (SEM vídeo)
    // ═══════════════════════════════════════════════
    let filteredEmbryos: GeminiV3Result[] = [];
    let originalIndexes: number[] = [];
    let rawAiCount = 0;
    let activityScores: number[] = [];

    // Dados de atividade por embrião (do Cloud Run)
    interface KineticProfile {
      core_activity: number;
      periphery_activity: number;
      peak_zone: string;
      temporal_pattern: string;
      activity_timeline: number[];
      temporal_variability: number;
      activity_symmetry: number;
      focal_activity_detected: boolean;
    }
    interface ActivityEmbryoData {
      index: number;
      activity_score: number;
      kinetic_profile: KineticProfile;
      kinetic_quality_score: number;
      clean_frames: string[];
      composite_frames: string[];
      cumulative_heatmap: string;
    }
    let activityEmbryos: ActivityEmbryoData[] = [];
    let compositePathsMap: Record<number, { frames: string[]; heatmap: string }> = {};

    if (hasCrops && hasOpenCVBboxes) {
      console.log(`[V3] Análise multi-frame + activity para ${detectedBboxes!.length} embriões`);

      // Calibração v3.1 — scores independentes
      let calibrationWithWeights = calibrationText;

      if (fewShotExamples) {
        calibrationWithWeights += `\n\n═══════════════════════════════════════════════\nEXEMPLOS DE REFERÊNCIA (FEW-SHOT)\n═══════════════════════════════════════════════\n${fewShotExamples}`;
      }

      // ── V3 Passo 1: Signed URL do vídeo para Cloud Run ──
      const { data: signedUrlData } = await supabase.storage
        .from('embryo-videos')
        .createSignedUrl(media.arquivo_path, 600);

      if (!signedUrlData?.signedUrl) {
        throw new Error('Falha ao criar signed URL do vídeo para activity analysis');
      }

      // ── V3 Passo 2: Cloud Run /analyze-activity ──
      console.log(`[V3] Chamando /analyze-activity com ${detectedBboxes!.length} bboxes`);
      const activityResp = await fetch(`${FRAME_EXTRACTOR_URL}/analyze-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: signedUrlData.signedUrl,
          bboxes: detectedBboxes!.map((b: DetectedBbox) => ({
            x_percent: b.x_percent,
            y_percent: b.y_percent,
            width_percent: b.width_percent,
            height_percent: b.height_percent,
          })),
          fps: 8,
          num_key_frames: 10,
          output_size: 400,
        }),
      });

      if (!activityResp.ok) {
        const errText = await activityResp.text();
        throw new Error(`Cloud Run analyze-activity falhou (${activityResp.status}): ${errText.substring(0, 300)}`);
      }

      const activityData = await activityResp.json();
      activityScores = activityData.activity_scores || [];
      activityEmbryos = activityData.embryos || [];

      console.log(`[V3] Activity scores: [${activityScores.join(', ')}], frames_sampled: ${activityData.frames_sampled}`);
      console.log(`[V3] Embryos: ${activityEmbryos.length}, fields per embryo: ${activityEmbryos[0] ? Object.keys(activityEmbryos[0]).join(',') : 'none'}`);

      // ── V3 Passo 2b: Salvar composites + heatmaps no Storage (debug/inspeção) ──
      try {
        const uploadTs = Date.now();
        const uploads: Promise<{ data: unknown; error: { message: string } | null }>[] = [];

        for (let eIdx = 0; eIdx < activityEmbryos.length; eIdx++) {
          const ae = activityEmbryos[eIdx];
          compositePathsMap[eIdx] = { frames: [], heatmap: '' };

          for (let fIdx = 0; fIdx < ae.composite_frames.length; fIdx++) {
            const p = `${loteFivId}/${job.lote_fiv_acasalamento_id}/composites/${uploadTs}_e${eIdx}_f${fIdx}.jpg`;
            compositePathsMap[eIdx].frames.push(p);
            const bytes = Uint8Array.from(atob(ae.composite_frames[fIdx]), (c: string) => c.charCodeAt(0));
            uploads.push(supabase.storage.from('embryo-videos').upload(p, bytes, { contentType: 'image/jpeg', upsert: true }));
          }

          const hp = `${loteFivId}/${job.lote_fiv_acasalamento_id}/composites/${uploadTs}_e${eIdx}_heatmap.jpg`;
          compositePathsMap[eIdx].heatmap = hp;
          const hBytes = Uint8Array.from(atob(ae.cumulative_heatmap), (c: string) => c.charCodeAt(0));
          uploads.push(supabase.storage.from('embryo-videos').upload(hp, hBytes, { contentType: 'image/jpeg', upsert: true }));
        }

        await Promise.all(uploads);
        console.log(`[V3] ${uploads.length} composites/heatmaps salvos no Storage`);
      } catch (uploadErr) {
        console.warn(`[V3] Composite upload falhou: ${uploadErr instanceof Error ? uploadErr.message : 'unknown'}`);
      }

      // ── V3 Passo 3: Buscar dia pós-FIV ──
      let diasPosFiv: number | null = null;
      try {
        const { data: loteData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('lote_fiv_id, lotes_fiv(data_abertura)')
          .eq('id', job.lote_fiv_acasalamento_id)
          .single();

        const dataAbertura = (loteData?.lotes_fiv as { data_abertura?: string } | null)?.data_abertura;
        if (dataAbertura) {
          diasPosFiv = Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 86400000);
        }
      } catch {
        console.warn('[V3] Não foi possível buscar dia pós-FIV');
      }

      const diasPosFivContext = diasPosFiv != null
        ? `Dia pós-FIV: D${diasPosFiv}\nD7: Espera-se Blastocisto (Bl) a Blastocisto expandido (Bx). Bx é ideal.\nD8: Espera-se Bx a Blastocisto em eclosão (Bh). Mórula em D8 = atraso.`
        : 'Dia pós-FIV: não disponível';

      // Preencher placeholders de contexto na calibração
      calibrationWithWeights = calibrationWithWeights
        .replace('{dias_pos_fiv_context}', diasPosFivContext)
        .replace('{doadora_info}', '')
        .replace('{touro_info}', '')
        .replace('{receptora_info}', '')
        .replace('{historico_info}', '');

      // ── V3 Passo 4: N chamadas paralelas ao Gemini (10 frames LIMPOS + perfil cinético como TEXTO) ──
      interface ParallelResult {
        index: number;
        error: string | null;
        result: GeminiV3Result | null;
      }

      const geminiPromises: Promise<ParallelResult>[] = detectedBboxes!.map((_bbox: DetectedBbox, index: number) => {
        const embryoActivity = activityEmbryos[index];
        if (!embryoActivity || !embryoActivity.clean_frames || embryoActivity.clean_frames.length === 0) {
          return Promise.resolve({ index, error: 'Sem dados de atividade para este embrião', result: null });
        }

        const parts: Array<Record<string, unknown>> = [];

        // 10 frames LIMPOS (sem overlay — Gemini avalia APENAS morfologia visual)
        for (const frameB64 of embryoActivity.clean_frames) {
          parts.push({ inline_data: { mime_type: 'image/jpeg', data: frameB64 } });
        }

        // NÃO envia heatmap ao Gemini — ele interpreta NÚMEROS, não imagens de atividade

        // Construir texto do perfil cinético para o Gemini interpretar clinicamente
        const kp = embryoActivity.kinetic_profile;
        let kineticProfileText = `- Atividade geral: ${embryoActivity.activity_score}/100`;
        if (kp) {
          kineticProfileText = [
            `- Atividade geral: ${embryoActivity.activity_score}/100 (compensada por ruído de câmera)`,
            `- Zona central (MCI): ${kp.core_activity ?? 0}/100`,
            `- Zona periférica (TE/ZP): ${kp.periphery_activity ?? 0}/100`,
            `- Zona de pico: ${kp.peak_zone === 'core' ? 'centro (MCI)' : kp.peak_zone === 'periphery' ? 'periferia (TE/ZP)' : 'uniforme'}`,
            `- Padrão temporal: ${kp.temporal_pattern ?? 'stable'}`,
            `- Simetria de atividade: ${kp.activity_symmetry ?? 1} (0=assimétrica, 1=simétrica)`,
            `- Atividade focal concentrada: ${kp.focal_activity_detected ? 'SIM (possível hatching)' : 'NÃO'}`,
          ].join('\n');
        } else {
          console.warn(`[V3] Embrião ${index}: kinetic_profile ausente no Cloud Run response`);
        }

        // Prompt de análise v3 com valores substituídos
        const analysisPrompt = ANALYSIS_PROMPT_V3
          .replace('{activity_score}', String(embryoActivity.activity_score))
          .replace('{kinetic_quality_score}', String(embryoActivity.kinetic_quality_score))
          .replace('{kinetic_profile_text}', kineticProfileText)
          .replace('{dias_pos_fiv}', diasPosFiv != null ? `D${diasPosFiv}` : 'não disponível')
          .replace('{contexto_adicional}', '');

        parts.push({ text: analysisPrompt });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        return fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: calibrationWithWeights }] },
            contents: [{ parts }],
            generation_config: {
              temperature: 0,
              max_output_tokens: 4096,
              response_mime_type: 'application/json',
            },
          }),
        }).then(async (resp) => {
          clearTimeout(timeoutId);
          if (!resp.ok) return { index, error: await resp.text().then(t => t.substring(0, 300)), result: null };
          const data = await resp.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!raw) return { index, error: 'Gemini não retornou texto', result: null };
          let json = raw.trim();
          if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          const parsed = JSON.parse(json) as GeminiV3Result;
          const validationError = validateGeminiV3(parsed);
          if (validationError) return { index, error: `Validação: ${validationError}`, result: null };
          return { index, error: null, result: parsed };
        }).catch((err: unknown) => {
          clearTimeout(timeoutId);
          const msg = err instanceof Error && err.name === 'AbortError'
            ? `Timeout (${GEMINI_TIMEOUT_MS / 1000}s)`
            : String(err);
          return { index, error: msg, result: null };
        });
      });

      const parallelResults = await Promise.all(geminiPromises);

      // Processar resultados
      const failedResults = parallelResults.filter((r: ParallelResult) => !r.result);

      if (failedResults.length > 0) {
        console.warn(`[V3] ${failedResults.length} chamadas falharam:`,
          failedResults.map((r: ParallelResult) => `#${r.index}: ${r.error?.substring(0, 100)}`));
      }

      console.log(`[V3] ${parallelResults.length - failedResults.length}/${parallelResults.length} análises bem-sucedidas`);

      const successfulResults = parallelResults
        .sort((a: ParallelResult, b: ParallelResult) => a.index - b.index)
        .filter((r: ParallelResult) => r.result);

      filteredEmbryos = successfulResults.map((r: ParallelResult) => r.result!);
      originalIndexes = successfulResults.map((r: ParallelResult) => r.index);
      rawAiCount = filteredEmbryos.length;

      // Se TODAS as chamadas Gemini falharam
      if (filteredEmbryos.length === 0) {
        const errorDetails = failedResults
          .map((r: ParallelResult) => `#${r.index}: ${r.error?.substring(0, 80)}`)
          .join('; ');
        const errorMsg = `Todas as ${parallelResults.length} chamadas Gemini falharam: ${errorDetails}`.substring(0, 500);
        console.error(`[V3] ${errorMsg}`);

        await supabase
          .from('embryo_analysis_queue')
          .update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', queue_id);

        return new Response(
          JSON.stringify({ success: false, queue_id, error: errorMsg }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else {
      // ═══════════════════════════════════════════════
      // SEM CROPS/BBOXES → análise não roda (skipped)
      // ═══════════════════════════════════════════════
      console.log('[SKIPPED] Sem crops/bboxes — análise não pode ser realizada');

      await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'skipped',
          completed_at: new Date().toISOString(),
          error_message: 'Sem crops/bboxes detectados — análise requer detecção prévia',
        })
        .eq('id', queue_id);

      return new Response(
        JSON.stringify({
          success: false,
          queue_id,
          status: 'skipped',
          reason: 'Sem crops/bboxes — análise requer detecção prévia',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ═══════════════════════════════════════════════
    // Calcular scores server-side e salvar
    // ═══════════════════════════════════════════════
    const processingTime = Date.now() - startTime;
    const embryoCount = embryoCountInDb;
    const aiCount = filteredEmbryos.length;
    const countMismatch = embryoCount !== rawAiCount;
    const analysisMode = 'v3-multiframe-activity';

    // Buscar analysis_version máxima atual para incrementar
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

    const scoresToInsert = filteredEmbryos.map((aiEmbryo: GeminiV3Result, i: number) => {
      const origIdx = originalIndexes[i];
      const embriao = embrioes?.[origIdx];
      const morph = aiEmbryo.morphology;
      const viability = aiEmbryo.viability_prediction;
      const checklist = aiEmbryo.quality_checklist;
      const confidence = aiEmbryo.confidence || 'medium';

      // Scores independentes — morfologia e cinética avaliadas separadamente
      const morphScore = clamp(morph?.score ?? 0, 0, 100);
      const rawActivityScore = clamp(activityScores[origIdx] ?? 0, 0, 100);
      const embryoActivity = activityEmbryos[origIdx];
      const kineticQuality = clamp(embryoActivity?.kinetic_quality_score ?? 0, 0, 100);
      const kineticProfile = embryoActivity?.kinetic_profile;
      const calculatedScore = morphScore; // Score principal = morfologia
      const geminiOriginalScore = aiEmbryo.embryo_score;

      // Classificação DETERMINÍSTICA baseada no score calculado
      const { classification, recommendation } = classifyScore(calculatedScore);

      return {
        embriao_id: embriao?.id || null,
        media_id: job.media_id,
        is_current: true,
        analysis_version: nextVersion,

        // Score principal = morfologia (cinética salva independente em kinetic_score)
        embryo_score: calculatedScore,
        classification,
        transfer_recommendation: recommendation,
        confidence,
        reasoning: aiEmbryo.reasoning,

        // Morfologia (do Gemini multi-frame)
        morph_score: morphScore,
        stage: morph?.stage,
        icm_grade: morph?.icm_grade,
        icm_description: morph?.icm_description,
        te_grade: morph?.te_grade,
        te_description: morph?.te_description,
        zp_status: morph?.zp_status,
        fragmentation: morph?.fragmentation,
        morph_notes: morph?.notes,

        // Cinética v3 — dados do Cloud Run kinetic_profile + interpretação do Gemini
        kinetic_score: kineticQuality,
        global_motion: kineticProfile?.temporal_pattern || null,
        blastocele_pulsation: null,
        expansion_observed: null,
        stability: kineticProfile?.activity_symmetry != null
          ? (kineticProfile.activity_symmetry >= 0.7 ? 'Simétrica' : kineticProfile.activity_symmetry >= 0.4 ? 'Moderada' : 'Assimétrica')
          : null,
        icm_activity: kineticProfile?.core_activity != null ? `${kineticProfile.core_activity}/100` : null,
        te_activity: kineticProfile?.periphery_activity != null ? `${kineticProfile.periphery_activity}/100` : null,
        most_active_region: kineticProfile?.peak_zone === 'core' ? 'Centro (MCI)'
          : kineticProfile?.peak_zone === 'periphery' ? 'Periferia (TE/ZP)'
          : kineticProfile?.peak_zone === 'uniform' ? 'Uniforme' : null,
        motion_asymmetry: kineticProfile?.activity_symmetry != null ? String(kineticProfile.activity_symmetry) : null,
        kinetic_notes: aiEmbryo.kinetic_interpretation || null,
        viability_indicators: aiEmbryo.viability_indicators || [],

        // Novos campos v3
        activity_score: rawActivityScore,
        temporal_analysis: kineticProfile || null,
        viability_prediction: viability || null,
        quality_checklist: checklist || null,

        // Posição
        position_description: null,
        bbox_x_percent: hasOpenCVBboxes
          ? (detectedBboxes![origIdx]?.x_percent ?? null)
          : null,
        bbox_y_percent: hasOpenCVBboxes
          ? (detectedBboxes![origIdx]?.y_percent ?? null)
          : null,
        bbox_width_percent: hasOpenCVBboxes
          ? (detectedBboxes![origIdx]?.width_percent ?? null)
          : null,
        bbox_height_percent: hasOpenCVBboxes
          ? (detectedBboxes![origIdx]?.height_percent ?? null)
          : null,

        crop_image_path: cropPaths?.[origIdx] ?? null,

        model_used: modelName,
        morph_weight: 1.0,
        kinetic_weight: 0,
        prompt_version: 'v3.1',
        processing_time_ms: processingTime,
        raw_response: {
          _meta: {
            analysis_mode: analysisMode,
            original_index: origIdx,
            embryos_in_db: embryoCount,
            embryos_detected_by_ai: aiCount,
            count_mismatch: countMismatch,
            detection_source: hasOpenCVBboxes ? 'gemini' : 'none',
            detection_confidence: detectionConfidence,
            server_calculated: true,
            gemini_original_score: geminiOriginalScore,
            gemini_original_classification: aiEmbryo.classification,
            activity_score_raw: rawActivityScore,
            kinetic_quality_score: kineticQuality,
            morph_score_gemini: morphScore,
            kinetic_profile: kineticProfile || null,
            best_frame: morph?.best_frame,
            composite_paths: compositePathsMap[origIdx]?.frames || [],
            heatmap_path: compositePathsMap[origIdx]?.heatmap || null,
          },
        },
      };
    });

    const validScores = scoresToInsert.filter((s: { embriao_id: string | null }) => s.embriao_id);

    if (validScores.length === 0 && scoresToInsert.length > 0) {
      const errorMsg = `Matching falhou: ${scoresToInsert.length} resultado(s) da IA mas nenhum vinculado a embriões do banco. ` +
        `embrioes encontrados: ${embryoCountInDb}, indices usados: [${originalIndexes.join(',')}]`;
      console.error(`[EmbryoAnalyze] ${errorMsg}`);

      await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'failed',
          error_message: errorMsg.substring(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq('id', queue_id);

      return new Response(
        JSON.stringify({ success: false, queue_id, error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (validScores.length > 0) {
      const embriaoIds = validScores.map((s: { embriao_id: string }) => s.embriao_id);

      // SOFT-DELETE: marcar scores anteriores como não-current
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

    // ── Atualizar job → completed ──
    await supabase
      .from('embryo_analysis_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', queue_id);

    return new Response(
      JSON.stringify({
        success: true,
        queue_id,
        analysis_mode: analysisMode,
        embryos_detected: aiCount,
        embryos_in_db: embryoCount,
        scores_saved: validScores.length,
        count_mismatch: countMismatch,
        processing_time_ms: processingTime,
        model: modelName,
        server_calculated: true,
        activity_scores: activityScores,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('embryo-analyze error:', errorMessage, errorStack);

    if (queue_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('embryo_analysis_queue')
          .update({
            status: 'failed',
            error_message: errorMessage.substring(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq('id', queue_id);
      } catch {
        console.error('Falha ao atualizar job para failed');
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
