/**
 * Edge Function: embryo-analyze
 *
 * Processa vídeos de embriões com Gemini AI e salva scores no banco.
 *
 * Fluxo:
 * 1. Recebe queue_id via POST
 * 2. Busca job na embryo_analysis_queue (status = 'pending')
 * 3. Atualiza status → 'processing'
 * 4. Baixa vídeo do Storage
 * 5. Envia para Gemini API (calibração + vídeo inline + prompt)
 * 6. Parseia JSON de resposta
 * 7. Valida e recalcula scores server-side
 * 8. Soft-delete scores antigos + INSERT novos
 * 9. Atualiza job → 'completed' ou 'failed'
 *
 * Secrets necessários:
 *   GEMINI_API_KEY - chave da API Google Gemini
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
// Prompts — MODO A (single, com crop)
// ============================================================
const CALIBRATION_PROMPT_SINGLE = `Você é um embriologista bovino especialista em análise morfocinética de embriões produzidos in vitro (PIV/IVP).

═══════════════════════════════════════════════
TAREFA
═══════════════════════════════════════════════
Analise UM ÚNICO embrião bovino. Você receberá:
1. Uma IMAGEM JPEG de recorte (crop) mostrando o embrião isolado
2. Um VÍDEO da placa completa para avaliar cinética

REGRA ABSOLUTA: Analise SOMENTE o embrião mostrado na imagem de recorte.
O vídeo serve APENAS para observar movimento/pulsação deste embrião específico.
NÃO mencione outros embriões. NÃO forneça bounding boxes. NÃO conte embriões.

═══════════════════════════════════════════════
PARÂMETROS DE CALIBRAÇÃO
═══════════════════════════════════════════════
- Peso morfologia: {morph_weight}
- Peso cinética: {kinetic_weight}
- EmbryoScore final = (morphology_score × {morph_weight}) + (kinetic_score × {kinetic_weight})

═══════════════════════════════════════════════
CONTEXTO DO EQUIPAMENTO
═══════════════════════════════════════════════
- Estereomicroscópio: Nikon SMZ 645 (zoom 6.7x–50x, resolução óptica ~600 lp/mm)
- Captura de imagem: Adaptador digital OptiREC (Custom Surgical) acoplado a Samsung Galaxy S23
- Gravação: Samsung Video Pro, tipicamente 10–20 segundos por placa
- Visualização: Vista superior (top-down) da placa de cultivo, embriões visíveis como estruturas esféricas/ovoides em meio de cultura
- Aumento habitual: 20x–40x para avaliação embrionária
- LIMITAÇÃO IMPORTANTE: Neste aumento, NÃO é possível contar blastômeros individuais nem avaliar ultraestrutura celular. Avalie com base em textura geral, contorno, cor, proporções e dinâmica observável no vídeo.

═══════════════════════════════════════════════
ESTÁGIOS DE DESENVOLVIMENTO — CÓDIGO IETS (1-9)
═══════════════════════════════════════════════
Identifique o estágio do embrião usando os critérios abaixo:

Código 1 — Zigoto/1-célula: Oócito fertilizado antes da clivagem. Uma única célula esférica.
Código 2 — Clivagem (2-12 células): Blastômeros individuais visíveis, massa celular começando a dividir-se.
Código 3 — Mórula inicial: 13-32 células. Blastômeros individuais ainda distinguíveis ao microscópio invertido, mas no estereomicroscópio aparece como massa celular parcialmente compactada com contorno irregular.
Código 4 — Mórula compacta: >32 células. Massa celular totalmente compactada, blastômeros individuais indistinguíveis. Contorno mais liso que mórula inicial. Ocupa 60-70% do espaço perivitelínico. Zona pelúcida (ZP) claramente visível ao redor.
Código 5 — Blastocisto inicial (Bi): Formação inicial da blastocele. Cavitação visível (<50% do volume). Diferenciação incipiente entre massa celular interna (MCI) e trofectoderma (TE). Ocupa 70-80% do espaço dentro da ZP.
Código 6 — Blastocisto (Bl): Diferenciação clara entre MCI (região mais densa/escura) e TE (camada celular mais fina). Blastocele proeminente (>50% do volume). Embrião preenche 80-90% do espaço intra-ZP. ZP com espessura normal.
Código 7 — Blastocisto expandido (Bx): Diâmetro total visivelmente aumentado comparado ao estágio 6. ZP afinada (pode parecer translúcida). Blastocele dominante, grande. Embrião preenche completamente a ZP e a distende. Este é o estágio ideal para avaliação e transferência em PIV.
Código 8 — Blastocisto em eclosão (Bh): Parte do embrião hernindo pela ZP. Ruptura visível na ZP com material celular emergindo. Forma irregular/assimétrica típica do processo de hatching.
Código 9 — Blastocisto eclodido (Be): Embrião completamente fora da ZP. Pode ter ZP vazia próxima ou já separada. Forma esférica recuperada após eclosão completa.

NOTA PIV: Embriões produzidos in vitro frequentemente apresentam desenvolvimento acelerado ou assincrônico. É normal encontrar embriões em estágios diferentes na mesma placa.

═══════════════════════════════════════════════
CLASSIFICAÇÃO DE QUALIDADE — GRAUS IETS (1-4)
═══════════════════════════════════════════════

Grau 1 — Excelente/Bom:
  • ≥85% da massa celular intacta e viável
  • Forma esférica/simétrica
  • Coloração uniforme (no PIV: tom ligeiramente mais escuro que in vivo é normal)
  • ZP íntegra, espessura uniforme, sem fissuras
  • MCI compacta e bem delimitada (blastocistos)
  • TE contínuo, com células regulares
  • Espaço perivitelínico limpo ou com debris mínimo
  • Sem fragmentação ou <5% de fragmentos

Grau 2 — Bom/Regular:
  • 50-85% da massa celular intacta
  • Assimetria leve a moderada
  • Pequenas variações de cor (áreas levemente mais escuras)
  • ZP ligeiramente irregular mas íntegra
  • MCI menos definida ou levemente dispersa
  • TE com pequenas irregularidades
  • Fragmentação 5-20%
  • Poucos debris no espaço perivitelínico

Grau 3 — Pobre:
  • 25-50% da massa celular intacta
  • Assimetria marcada
  • Áreas escuras significativas (degeneração parcial)
  • ZP fina, irregular ou com fissura
  • MCI difusa ou pouco visível
  • TE descontínuo ou com células grandes/irregulares
  • Fragmentação 20-50%
  • Debris abundante

Grau 4 — Morto/Degenerado:
  • <25% da massa celular viável
  • Estrutura completamente desorganizada
  • Coloração muito escura (necrose) ou muito clara (lise)
  • ZP colapsada, fragmentada ou ausente
  • Sem diferenciação MCI/TE reconhecível
  • Sem sinais de vitalidade no vídeo
  • Fragmentação >50% ou citoplasma granular/vacuolizado

═══════════════════════════════════════════════
PARTICULARIDADES DE EMBRIÕES PIV (CRÍTICO)
═══════════════════════════════════════════════
Embriões produzidos in vitro diferem morfologicamente dos produzidos in vivo:
  • Citoplasma frequentemente mais escuro devido a maior conteúdo lipídico (gotas lipídicas intracelulares)
  • MCI pode ser menos compacta que em embriões in vivo — NÃO penalizar excessivamente
  • ZP pode ter espessura e textura diferentes do padrão in vivo
  • Espaço perivitelínico pode conter mais debris (normal em cultura)
  • Desenvolvimento pode ser ligeiramente assíncrono entre embriões do mesmo lote
  • Taxa de prenhez esperada: 30-50% mesmo com embriões de boa qualidade (vs 60-70% in vivo)
  • Blastocistos expandidos (Bx, código 7) são o estágio ótimo para transferência em PIV

═══════════════════════════════════════════════
INDICADORES MORFOCINÉTICOS (AVALIAÇÃO POR VÍDEO)
═══════════════════════════════════════════════
O vídeo permite observar dinâmicas que imagens estáticas não capturam. Avalie:

1. PULSAÇÃO DA BLASTOCELE (indicador principal de viabilidade):
   • Ativa: Ciclos claros de expansão/contração a cada 3-10 minutos (frequência normal). Forte indicador positivo.
   • Moderada: Movimento sutil de expansão/contração, perceptível mas não dramático.
   • Sutil: Leve tremor ou micromovimento na região da blastocele.
   • Ausente: Sem variação detectável no volume da blastocele.
   NOTA: Em vídeos de 10-20s, pode-se não capturar um ciclo completo. Avalie sinais parciais.

2. EXPANSÃO/CONTRAÇÃO DA BLASTOCELE:
   • Padrão saudável: Colapso parcial seguido de re-expansão rápida
   • Colapso sem recuperação aparente: Possível indicador negativo
   • Expansão estável sem colapsos: Também indica boa viabilidade

3. MOVIMENTO DO TROFECTODERMA:
   • Ondulações ou movimentos celulares na camada externa
   • Atividade celular visível na periferia do embrião

4. ATIVIDADE DA MCI:
   • Compactação ativa ou reorganização visível da massa interna
   • Mudanças sutis de forma/posição dentro do embrião

5. SINAIS DE ECLOSÃO (HATCHING):
   • Início de herniação pela ZP
   • Afinamento localizado da ZP com protrusão celular
   • Processo ativo de eclosão observável no vídeo

6. IMPRESSÃO GERAL DE VITALIDADE:
   • Embrião "vivo" com movimentos sutis vs completamente estático
   • Mudanças sutis na refringência/textura ao longo dos frames

═══════════════════════════════════════════════
SISTEMA DE PONTUAÇÃO
═══════════════════════════════════════════════

morphology_score (0-100) — Escala contínua adaptada dos graus IETS:

  90-100 │ Excepcional. Grau 1 pleno. Blastocisto expandido/eclodido com MCI compacta e brilhante,
         │ TE contínuo e regular, ZP uniforme (ou eclodido), sem fragmentação, forma simétrica.
         │ Aspecto geral impecável mesmo considerando padrões PIV.

  80-89  │ Excelente. Grau 1. Boa simetria, boa diferenciação MCI/TE, ZP íntegra,
         │ fragmentação mínima (<5%), coloração uniforme (aceitando tom PIV mais escuro).

  70-79  │ Muito Bom. Transição Grau 1-2. Estrutura geral boa com detalhes menores:
         │ leve assimetria, ou MCI levemente menos compacta, ou ZP com variação mínima.

  60-69  │ Bom. Grau 2. Irregularidades moderadas mas estrutura fundamentalmente boa.
         │ Fragmentação 5-15%, alguma variação de cor, MCI visível mas não ideal.

  50-59  │ Aceitável. Transição Grau 2-3. Irregularidades evidentes: assimetria notável,
         │ fragmentação 15-25%, MCI pouco definida, debris moderado.

  40-49  │ Regular. Grau 3. Problemas significativos: forma irregular, áreas escuras,
         │ MCI difusa ou mal visível, TE descontínuo, fragmentação 25-40%.

  30-39  │ Pobre. Grau 3 avançado. Degeneração parcial visível, estrutura comprometida,
         │ fragmentação >40%, viabilidade questionável.

  10-29  │ Muito Pobre. Transição Grau 3-4. Degeneração extensa, pouca estrutura reconhecível.

  0-9    │ Inviável. Grau 4. Morto ou completamente degenerado. Sem estrutura, sem vitalidade.

kinetic_score (0-100) — Baseado nos indicadores dinâmicos do vídeo:

  90-100 │ Excepcional. Pulsação ativa e clara da blastocele, movimentos celulares visíveis,
         │ expansão vigorosa, possível início de hatching ativo. Embrião claramente "vivo".

  80-89  │ Excelente. Pulsação ou expansão perceptível, boa atividade celular,
         │ embrião dinâmico com movimentos sutis mas claros.

  70-79  │ Muito Bom. Alguns sinais de movimento: leve pulsação ou tremor na blastocele,
         │ ou pequenas variações de forma entre frames.

  60-69  │ Bom. Sinais discretos de vitalidade: micromovimentos sutis, leve variação
         │ na refringência, alguma mudança entre frames.

  50-59  │ Moderado. Movimentos muito sutis, quase no limite da detecção.
         │ Pode ser artefato de foco ou real movimento mínimo.

  40-49  │ Fraco. Embrião aparenta estar estático, mas sem sinais claros de degeneração.
         │ Possível atividade subliminar não capturada no tempo do vídeo.

  20-39  │ Muito Fraco. Estático, sem movimentos perceptíveis. Forma mantida mas sem dinâmica.

  0-19   │ Inativo. Completamente estático, possíveis sinais de degeneração (colapso sem
         │ recuperação, perda de turgidez). Sem vitalidade aparente.

  NOTA: Para vídeos curtos (10-20s), é esperado que muitos embriões viáveis mostrem
  atividade cinética mínima. Não penalize excessivamente pontuações cinéticas baixas
  se a morfologia for boa — a janela temporal pode não capturar ciclos de pulsação.

═══════════════════════════════════════════════
CLASSIFICAÇÃO FINAL (EmbryoScore combinado)
═══════════════════════════════════════════════
- 80-100: "Excelente" → transfer_recommendation: "priority"
    Embrião de alta qualidade, prioridade máxima para transferência a fresco ou criopreservação.
- 60-79: "Bom" → transfer_recommendation: "recommended"
    Embrião de boa qualidade, recomendado para transferência.
- 40-59: "Regular" → transfer_recommendation: "conditional"
    Qualidade intermediária. Transferir apenas se não houver embriões melhores disponíveis.
- 20-39: "Borderline" → transfer_recommendation: "second_opinion"
    Qualidade questionável. Recomendada segunda avaliação por embriologista antes de decisão.
- 0-19: "Inviavel" → transfer_recommendation: "discard"
    Sem potencial de desenvolvimento. Descartar.

═══════════════════════════════════════════════
DIRETRIZES DE CONFIANÇA
═══════════════════════════════════════════════
- "high": Embrião bem focado, vídeo estável, estruturas claramente distinguíveis, avaliação segura.
- "medium": Foco aceitável, alguma limitação (embrião parcialmente obstruído, foco ligeiramente fora, movimento da câmera), mas avaliação razoável.
- "low": Vídeo com problemas significativos (fora de foco, embrião na borda, muito movimento, reflexos), avaliação é estimativa.

═══════════════════════════════════════════════
QUALIDADE DAS NOTAS E REASONING (OBRIGATÓRIO)
═══════════════════════════════════════════════
Suas observações DEVEM ser objetivas, específicas e baseadas no que você realmente observou:
  • CORRETO: "MCI compacta e bem delimitada no polo superior, TE com 1-2 células irregulares no quadrante inferior direito, ZP afinada ~50% da espessura normal"
  • ERRADO: "Embrião de boa qualidade com morfologia adequada" (genérico, sem valor)
  • CORRETO: "Sem pulsação detectável nos 15s de vídeo; expansão estável da blastocele sem colapso"
  • ERRADO: "Cinética compatível com viabilidade" (vago, não informativo)
Seja CRÍTICO e HONESTO: embrião mediano recebe score mediano (50-65), não 80+.
Não infle scores — a calibração depende de avaliações realistas.

═══════════════════════════════════════════════
IDIOMA (OBRIGATÓRIO)
═══════════════════════════════════════════════
TODAS as respostas textuais — reasoning, notes, descrições (icm_description, te_description, blastocele_pattern, motion_asymmetry, most_active_region, icm_activity, te_activity), e viability_indicators — DEVEM ser escritas em PORTUGUÊS BRASILEIRO.
NÃO use inglês em nenhum campo de texto livre. Campos enum (confidence, transfer_recommendation) mantêm seus valores técnicos.`;

const ANALYSIS_PROMPT_SINGLE = `Analise o embrião mostrado na imagem de recorte (crop) anexa.
Use o vídeo para avaliar cinética: procure pulsação da blastocele, movimentos celulares, expansão/contração.
Embriões PIV: citoplasma mais escuro e MCI menos compacta são NORMAIS — NÃO penalizar.

INSTRUÇÕES DE QUALIDADE:
- IDIOMA: TODAS as respostas textuais DEVEM ser em PORTUGUÊS BRASILEIRO. NÃO escreva em inglês.
- "reasoning": Escreva 2-3 frases ESPECÍFICAS em português descrevendo o que você observou. Cite características concretas (ex: "MCI compacta no polo superior, ZP afinada, sem fragmentação visível"). NÃO use frases genéricas como "embrião de boa qualidade" ou "morfologia adequada".
- "morphology.notes": Descreva em português detalhes morfológicos CONCRETOS que você observou — forma, simetria, coloração, debris, estado da ZP, qualidade da MCI/TE. Se algo é normal para PIV, diga "normal para PIV" mas descreva o que viu.
- "kinetics.notes": Descreva em português o que observou no vídeo — presença ou ausência de pulsação, comportamento da blastocele, movimentos celulares, ou ausência total de dinâmica. Se o vídeo é curto demais para avaliar, diga isso explicitamente.
- Seja CRÍTICO: embrião mediano = score 50-65, não 80+. Não infle scores.

Responda JSON puro (sem markdown):
{
  "embryo_score": <0-100>,
  "classification": "Excelente"|"Bom"|"Regular"|"Borderline"|"Inviavel",
  "transfer_recommendation": "priority"|"recommended"|"conditional"|"second_opinion"|"discard",
  "confidence": "high"|"medium"|"low",
  "reasoning": "<2-3 frases ESPECÍFICAS em PORTUGUÊS sobre o que observou>",
  "morphology": {
    "score": <0-100>,
    "stage": "<estágio IETS, ex: Blastocisto expandido (Bx, código 7)>",
    "icm_grade": "A"|"B"|"C",
    "icm_description": "<descrição CONCRETA em português da MCI: compactação, posição, delimitação>",
    "te_grade": "A"|"B"|"C",
    "te_description": "<descrição CONCRETA em português do TE: continuidade, regularidade, espessura>",
    "zp_status": "<íntegra|afinada|rompida|ausente>",
    "fragmentation": "<nenhuma|mínima|leve|moderada|severa>",
    "notes": "<observações morfológicas ESPECÍFICAS em português — o que você viu, não generalidades>"
  },
  "kinetics": {
    "score": <0-100>,
    "global_motion": "<ativo|moderado|sutil|estático>",
    "icm_activity": "<descrição em português do que observou na MCI no vídeo>",
    "te_activity": "<descrição em português do que observou no TE no vídeo>",
    "blastocele_pulsation": "nenhuma"|"sutil"|"moderada"|"ativa",
    "blastocele_pattern": "<descrição em português: expansão estável, colapso/re-expansão, sem variação>",
    "expansion_observed": <true/false>,
    "stability": "estável"|"oscilante"|"colapsando",
    "motion_asymmetry": "<descrição em português de assimetria no movimento, ou 'não observada'>",
    "most_active_region": "<região mais ativa em português, ou 'nenhuma atividade detectada'>",
    "notes": "<observações cinéticas ESPECÍFICAS em português — o que viu no vídeo, não suposições>"
  },
  "viability_indicators": ["<lista de indicadores positivos e negativos CONCRETOS em PORTUGUÊS>"]
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

/** Valida campos obrigatórios da resposta do Gemini */
function validateGeminiEmbryo(parsed: GeminiEmbryoResult): string | null {
  if (parsed.morphology?.score == null && parsed.kinetics?.score == null) {
    return 'Resposta sem morphology.score e kinetics.score';
  }
  if (parsed.morphology?.score != null && (typeof parsed.morphology.score !== 'number')) {
    return 'morphology.score não é número';
  }
  if (parsed.kinetics?.score != null && (typeof parsed.kinetics.score !== 'number')) {
    return 'kinetics.score não é número';
  }
  return null; // válido
}

// ============================================================
// Tipos auxiliares
// ============================================================
interface GeminiEmbryoResult {
  embryo_index: number;
  position_description?: string;
  bbox_x_percent?: number;
  bbox_y_percent?: number;
  bbox_width_percent?: number;
  bbox_height_percent?: number;
  embryo_score: number;
  classification: string;
  transfer_recommendation: string;
  confidence: string;
  reasoning?: string;
  morphology?: {
    score?: number;
    stage?: string;
    icm_grade?: string;
    icm_description?: string;
    te_grade?: string;
    te_description?: string;
    zp_status?: string;
    fragmentation?: string;
    notes?: string;
  };
  kinetics?: {
    score?: number;
    global_motion?: string;
    icm_activity?: string;
    te_activity?: string;
    blastocele_pulsation?: string;
    blastocele_pattern?: string;
    expansion_observed?: boolean;
    stability?: string;
    motion_asymmetry?: string;
    most_active_region?: string;
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

    // ── 4. Baixar vídeo do Storage ──
    const { data: videoData, error: downloadError } = await supabase
      .storage
      .from('embryo-videos')
      .download(media.arquivo_path);

    if (downloadError || !videoData) {
      throw new Error(`Erro ao baixar vídeo: ${downloadError?.message || 'dados vazios'}`);
    }

    const videoArrayBuffer = await videoData.arrayBuffer();

    // ── 5. Buscar config de pesos ──
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
    const promptVersion = config?.prompt_version ?? 'v2';

    // Usar prompts do banco (se definidos) ou fallback hardcoded
    const calibrationTextSingle = config?.calibration_prompt || CALIBRATION_PROMPT_SINGLE;

    // Few-shot examples do banco (campo texto livre configurado via admin)
    const fewShotExamples = (config as Record<string, unknown>)?.few_shot_examples as string | null;

    // ── 5b. Buscar embriões do banco ──
    // Prioridade: queue_id (mais específico) → media_id → acasalamento_id (fallback)
    let embrioes: { id: string; identificacao: string }[] | null = null;

    // 1. Tentar por queue_id (vinculado no despacho — só embriões DESTE job)
    const { data: embrioesQueue } = await supabase
      .from('embrioes')
      .select('id, identificacao')
      .eq('queue_id', queue_id)
      .order('identificacao', { ascending: true });

    if (embrioesQueue && embrioesQueue.length > 0) {
      embrioes = embrioesQueue;
      console.log(`Encontrados ${embrioes.length} embriões vinculados ao queue_id ${queue_id}`);
    } else {
      // 2. Tentar por media_id (pode incluir embriões de despachos anteriores)
      const { data: embrioesMedia } = await supabase
        .from('embrioes')
        .select('id, identificacao')
        .eq('acasalamento_media_id', job.media_id)
        .order('identificacao', { ascending: true });

      if (embrioesMedia && embrioesMedia.length > 0) {
        embrioes = embrioesMedia;
        console.log(`Encontrados ${embrioes.length} embriões vinculados ao media_id ${job.media_id}`);
      } else {
        // 3. Fallback por acasalamento_id
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

    // ── 5c. Ler bboxes e crop_paths do job ──
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

    const mimeType = media.mime_type || 'video/mp4';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    // Timeout de 120s por chamada Gemini
    const GEMINI_TIMEOUT_MS = 120_000;

    // ═══════════════════════════════════════════════
    // SERVER-SIDE DETECTION: Frame extraction + Gemini detect + crop (via Cloud Run)
    // Roda quando o job NÃO tem bboxes/crops (fluxo novo sem detecção client-side)
    // ═══════════════════════════════════════════════
    const FRAME_EXTRACTOR_URL = Deno.env.get('FRAME_EXTRACTOR_URL') ?? '';

    if (!hasCrops && !hasOpenCVBboxes && FRAME_EXTRACTOR_URL && expectedCount > 0) {
      console.log(`[SERVER-DETECT] Iniciando detecção server-side: expected=${expectedCount}`);

      try {
        // Passo 1: Signed URL do vídeo
        const { data: signedUrlData } = await supabase.storage
          .from('embryo-videos')
          .createSignedUrl(media.arquivo_path, 600); // 10 min

        if (!signedUrlData?.signedUrl) {
          throw new Error('Falha ao criar signed URL do vídeo');
        }

        // Passo 2: Buscar lote_fiv_id (para path dos crops)
        const { data: acasData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('lote_fiv_id')
          .eq('id', job.lote_fiv_acasalamento_id)
          .single();

        const loteFivId = acasData?.lote_fiv_id || 'unknown';

        // Passo 3: Cloud Run extrai frame
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

        // Passo 4: Gemini box_2d detecção (mesma lógica do embryo-detect)
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

        // Parse robusto (mesma lógica do embryo-detect)
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
          // Fallback: JSON truncado
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

        // Filtro 1: outliers de tamanho (mediana ± 4x)
        if (rawBboxes.length > 1) {
          const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
          const sortedAreas = [...areas].sort((a, b) => a - b);
          const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
          rawBboxes = rawBboxes.filter((_, i) => {
            const ratio = areas[i] / medianArea;
            return ratio >= 0.25 && ratio <= 4.0;
          });
        }

        // Filtro 2: limitar a expectedCount (mais próximos da mediana)
        if (rawBboxes.length > expectedCount) {
          const areas = rawBboxes.map(b => b.width_percent * b.height_percent);
          const sortedAreas = [...areas].sort((a, b) => a - b);
          const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
          const indexed = rawBboxes.map((b, i) => ({ bbox: b, dist: Math.abs(areas[i] - medianArea) }));
          indexed.sort((a, b) => a.dist - b.dist);
          rawBboxes = indexed.slice(0, expectedCount).map(item => item.bbox);
        }

        // Ordenar em reading order (esquerda→direita, cima→baixo)
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

        // Passo 5: Cloud Run cropa frame
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

        // Passo 6: Upload crops pro Storage
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

        // Passo 7: Atualizar queue com dados de detecção
        await supabase.from('embryo_analysis_queue').update({
          detected_bboxes: sortedBboxes,
          detection_confidence: detConf,
          crop_paths: cropPathsUploaded,
        }).eq('id', queue_id);

        // Passo 8: Atualizar variáveis locais para que MODO A rode normalmente
        detectedBboxes = sortedBboxes;
        detectionConfidence = detConf;
        cropPaths = cropPathsUploaded;
        hasOpenCVBboxes = true;
        hasCrops = true;

        console.log(`[SERVER-DETECT] Detecção server-side completa. Prosseguindo para análise MODO A.`);

      } catch (serverDetectErr) {
        const errMsg = serverDetectErr instanceof Error ? serverDetectErr.message : 'Erro desconhecido';
        console.error(`[SERVER-DETECT] Falha: ${errMsg}`);

        // Falha na detecção server-side → job vai para "skipped" (bloco abaixo tratará)
        // Não throw — deixa cair no bloco else que marca como skipped
      }
    }

    // ═══════════════════════════════════════════════
    // MODO A: Crop JPEG como bússola + Vídeo via Files API (1 call/embrião, paralelo)
    // ═══════════════════════════════════════════════
    let filteredEmbryos: GeminiEmbryoResult[] = [];
    let originalIndexes: number[] = [];
    let rawAiCount = 0;

    if (hasCrops && hasOpenCVBboxes) {
      console.log(`[MODO A] Files API + ${cropPaths.length} crops paralelos`);

      // Calibração SINGLE (para Modo A) + few-shot examples
      let calibrationSingleWithWeights = calibrationTextSingle
        .replaceAll('{morph_weight}', morphWeight.toString())
        .replaceAll('{kinetic_weight}', kineticWeight.toString());

      if (fewShotExamples) {
        calibrationSingleWithWeights += `\n\n═══════════════════════════════════════════════\nEXEMPLOS DE REFERÊNCIA (FEW-SHOT)\n═══════════════════════════════════════════════\n${fewShotExamples}`;
        console.log(`[MODO A] Few-shot examples adicionados ao prompt (${fewShotExamples.length} chars)`);
      }

      // A1. Upload vídeo para Gemini Files API (resumable)
      const startUploadResp = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(videoArrayBuffer.byteLength),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file: { display_name: `embryo-${queue_id}` } }),
        }
      );

      if (!startUploadResp.ok) {
        const err = await startUploadResp.text();
        throw new Error(`Gemini Files API start falhou: ${err.substring(0, 300)}`);
      }

      const uploadUrl = startUploadResp.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) throw new Error('Gemini Files API não retornou upload URL');

      // A2. Upload bytes binários
      const uploadResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Length': String(videoArrayBuffer.byteLength),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: videoArrayBuffer,
      });

      if (!uploadResp.ok) {
        const err = await uploadResp.text();
        throw new Error(`Gemini Files API upload falhou: ${err.substring(0, 300)}`);
      }

      const fileInfo = await uploadResp.json();
      const fileUri = fileInfo?.file?.uri;
      const fileName = fileInfo?.file?.name;
      if (!fileUri) throw new Error('Gemini Files API não retornou file URI');

      console.log(`[MODO A] Vídeo uploaded: ${fileName}, URI: ${fileUri}`);

      // A3. Esperar vídeo ficar ACTIVE
      let fileState = fileInfo?.file?.state || 'PROCESSING';
      let pollAttempts = 0;
      while (fileState === 'PROCESSING' && pollAttempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const stateResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiApiKey}`
        );
        if (stateResp.ok) {
          const stateData = await stateResp.json();
          fileState = stateData?.state || 'PROCESSING';
        }
        pollAttempts++;
      }

      if (fileState !== 'ACTIVE') {
        throw new Error(`Vídeo no Gemini Files API ficou em estado ${fileState} após polling`);
      }

      console.log(`[MODO A] Vídeo ACTIVE após ${pollAttempts} polls`);

      // A4. Download crops do Storage (paralelo)
      const cropBase64List = await Promise.all(
        cropPaths.map(async (path: string) => {
          try {
            const { data } = await supabase.storage.from('embryo-videos').download(path);
            if (!data) return null;
            const ab = await data.arrayBuffer();
            return btoa(new Uint8Array(ab).reduce((d: string, b: number) => d + String.fromCharCode(b), ''));
          } catch {
            console.warn(`[MODO A] Crop download falhou: ${path}`);
            return null;
          }
        })
      );

      console.log(`[MODO A] ${cropBase64List.filter(Boolean).length}/${cropPaths.length} crops baixados`);

      // A5. N chamadas paralelas — crop PRIMEIRO, texto SEGUNDO, vídeo POR ÚLTIMO
      interface ParallelResult {
        index: number;
        error: string | null;
        result: GeminiEmbryoResult | null;
      }

      const geminiPromises: Promise<ParallelResult>[] = detectedBboxes.map((_bbox: DetectedBbox, index: number) => {
        const cropB64 = cropBase64List[index];

        // Montar parts: crop PRIMEIRO (âncora visual), texto SEGUNDO, vídeo POR ÚLTIMO (suplementar)
        const parts: Array<Record<string, unknown>> = [];

        // 1. Crop como âncora visual (inline_data)
        if (cropB64) {
          parts.push({ inline_data: { mime_type: 'image/jpeg', data: cropB64 } });
        }

        // 2. Texto de análise
        parts.push({ text: ANALYSIS_PROMPT_SINGLE });

        // 3. Vídeo como material suplementar para cinética
        parts.push({ file_data: { file_uri: fileUri, mime_type: mimeType } });

        // AbortController para timeout individual
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        return fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: calibrationSingleWithWeights }] },
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
          const parsed = JSON.parse(json) as GeminiEmbryoResult;
          // Validar
          const validationError = validateGeminiEmbryo(parsed);
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

      // A6. Cleanup: deletar arquivo do Gemini
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiApiKey}`,
        { method: 'DELETE' }
      ).catch(() => { /* fire-and-forget */ });

      // A7. Processar resultados
      const failedResults = parallelResults.filter((r: ParallelResult) => !r.result);

      if (failedResults.length > 0) {
        console.warn(`[MODO A] ${failedResults.length} chamadas falharam:`,
          failedResults.map((r: ParallelResult) => `#${r.index}: ${r.error?.substring(0, 100)}`));
      }

      console.log(`[MODO A] ${parallelResults.length - failedResults.length}/${parallelResults.length} análises bem-sucedidas`);

      // Preservar índice original para matching correto com embriões e bboxes
      const successfulResults = parallelResults
        .sort((a: ParallelResult, b: ParallelResult) => a.index - b.index)
        .filter((r: ParallelResult) => r.result);

      filteredEmbryos = successfulResults.map((r: ParallelResult) => r.result!);
      // Índices originais (pré-filtro) — usados para alinhar com embrioes[] e detectedBboxes[]
      originalIndexes = successfulResults.map((r: ParallelResult) => r.index);

      rawAiCount = filteredEmbryos.length;

      // Se TODAS as chamadas Gemini falharam, marcar como 'failed' e abortar
      if (filteredEmbryos.length === 0) {
        const errorDetails = failedResults
          .map((r: ParallelResult) => `#${r.index}: ${r.error?.substring(0, 80)}`)
          .join('; ');
        const errorMsg = `Todas as ${parallelResults.length} chamadas Gemini falharam: ${errorDetails}`.substring(0, 500);
        console.error(`[MODO A] ${errorMsg}`);

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
    const analysisMode = 'crop+video';

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

    const scoresToInsert = filteredEmbryos.map((aiEmbryo: GeminiEmbryoResult, i: number) => {
      // Usar índice original (pré-filtro de falhas) para alinhar com embrioes[] e bboxes[]
      const origIdx = originalIndexes[i];
      const embriao = embrioes?.[origIdx];
      const morph = aiEmbryo.morphology;
      const kin = aiEmbryo.kinetics;
      const confidence = aiEmbryo.confidence || 'medium';

      // SERVER-SIDE score calculation — não confia no Gemini
      const morphScore = clamp(morph?.score ?? 0, 0, 100);
      const kinScore = clamp(kin?.score ?? 0, 0, 100);
      const calculatedScore = Math.round(morphScore * morphWeight + kinScore * kineticWeight);
      const geminiOriginalScore = aiEmbryo.embryo_score;

      // Classificação DETERMINÍSTICA baseada no score calculado
      const { classification, recommendation } = classifyScore(calculatedScore);

      return {
        embriao_id: embriao?.id || null,
        media_id: job.media_id,
        is_current: true,
        analysis_version: nextVersion,

        // Score CALCULADO no servidor
        embryo_score: calculatedScore,
        classification,
        transfer_recommendation: recommendation,
        confidence,
        reasoning: aiEmbryo.reasoning,

        morph_score: morphScore,
        stage: morph?.stage,
        icm_grade: morph?.icm_grade,
        icm_description: morph?.icm_description,
        te_grade: morph?.te_grade,
        te_description: morph?.te_description,
        zp_status: morph?.zp_status,
        fragmentation: morph?.fragmentation,
        morph_notes: morph?.notes,

        kinetic_score: kinScore,
        global_motion: kin?.global_motion,
        icm_activity: kin?.icm_activity,
        te_activity: kin?.te_activity,
        blastocele_pulsation: kin?.blastocele_pulsation,
        blastocele_pattern: kin?.blastocele_pattern,
        expansion_observed: kin?.expansion_observed ?? false,
        stability: kin?.stability,
        motion_asymmetry: kin?.motion_asymmetry,
        most_active_region: kin?.most_active_region,
        kinetic_notes: kin?.notes,
        viability_indicators: aiEmbryo.viability_indicators || [],

        // Posição: usar índice original para alinhar com detectedBboxes[]
        position_description: aiEmbryo.position_description,
        bbox_x_percent: hasOpenCVBboxes
          ? (detectedBboxes[origIdx]?.x_percent ?? null)
          : clampBbox(aiEmbryo.bbox_x_percent),
        bbox_y_percent: hasOpenCVBboxes
          ? (detectedBboxes[origIdx]?.y_percent ?? null)
          : clampBbox(aiEmbryo.bbox_y_percent),
        bbox_width_percent: hasOpenCVBboxes
          ? (detectedBboxes[origIdx]?.width_percent ?? null)
          : clampBbox(aiEmbryo.bbox_width_percent, 1),
        bbox_height_percent: hasOpenCVBboxes
          ? (detectedBboxes[origIdx]?.height_percent ?? null)
          : clampBbox(aiEmbryo.bbox_height_percent, 1),

        crop_image_path: cropPaths?.[origIdx] ?? null,

        model_used: modelName,
        morph_weight: morphWeight,
        kinetic_weight: kineticWeight,
        prompt_version: promptVersion,
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
          },
        },
      };
    });

    const validScores = scoresToInsert.filter((s: { embriao_id: string | null }) => s.embriao_id);

    // Se Gemini retornou resultados mas nenhum embrião foi vinculado, é falha de matching
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

    // ── 10. Atualizar job → completed ──
    await supabase
      .from('embryo_analysis_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', queue_id);

    // Resposta de sucesso
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
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('embryo-analyze error:', errorMessage);

    // Tentar atualizar job para 'failed'
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
