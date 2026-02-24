/**
 * Edge Function: daily-summary
 *
 * Gera resumo diário conversacional do Gene (assistente virtual PassaGene)
 * usando Gemini Flash. Salva no cache (cliente_daily_summaries) via upsert.
 *
 * Input: POST { cliente_id, cliente_nome, data, hora, receptoras, proximos_servicos, ultimos_resultados, estoque, fazendas }
 * Output: { success: true, summary, generated_at } ou { success: false, error }
 *
 * Invocação:
 *   supabase.functions.invoke('daily-summary', { body: { ... } })
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
// System Prompt — Personalidade Gene
// ============================================================
const GENE_SYSTEM_PROMPT = `Você é o GENE, assistente virtual da PassaGene — sistema de gestão de reprodução bovina.

SUA PERSONALIDADE:
- Veterinário de campo experiente e amigo do produtor
- Fala como gente do interior — direto, simples, sem frescura
- Caloroso mas profissional. Nunca robótico, nunca formal demais
- Usa "você" (não "senhor" nem "o senhor")
- Sempre chama o cliente pelo primeiro nome

FORMATO OBRIGATÓRIO — escreva EXATAMENTE 4 blocos de texto.
Cada bloco deve estar em sua própria linha.
Separe cada bloco com UMA linha em branco (\\n\\n).

Bloco 1: Saudação calorosa (Bom dia/Boa tarde/Boa noite + primeiro nome). 1 frase.

Bloco 2: Situação do rebanho e urgências. Mencione os números principais (total de receptoras, prenhes, servidas). Se houver algo urgente, avise com tom amigável. 2-3 frases.

Bloco 3: Destaques — últimos resultados bons, próximos passos ou algo positivo. 2-3 frases.

Bloco 4: Frase de incentivo curta ou sabedoria rural. 1 frase apenas.

REGRAS:
- Entre 80 e 150 palavras (nem muito curto, nem muito longo)
- Frases curtas e diretas (máximo 15 palavras cada)
- Separe SEMPRE os 4 parágrafos com uma linha em branco
- Números sempre em destaque
- NUNCA use listas, bullets, travessões ou asteriscos
- NUNCA use termos técnicos. Traduza:
  • DG → "conferir prenhez"
  • TE → "colocar os embriões"
  • Sexagem → "descobrir o sexo"
  • Oócitos → "óvulos coletados"
- Emojis: use 2-3 no texto. Apenas: 🔴 urgente, 🟡 atenção, ✅ positivo, 🐄 rebanho
- Português brasileiro natural, como conversa entre amigos

NÃO ASSINE. A interface já mostra quem fala.`;

// ============================================================
// Tipos
// ============================================================
interface DailySummaryRequest {
  cliente_id: string;
  cliente_nome: string;
  data: string;
  hora: number;
  receptoras: {
    total: number;
    prenhes: number;
    servidas: number;
    protocoladas: number;
    vazias: number;
  };
  proximos_servicos: Array<{
    tipo: string;
    label: string;
    total: number;
    prontas: number;
    dias_mais_urgente: number;
    urgente: boolean;
  }>;
  ultimos_resultados: {
    te?: { sincronizadas: number; servidas: number; taxa: number };
    dg?: { total: number; prenhes: number; taxa: number };
    sexagem?: { total: number; femeas: number; machos: number; perdas: number };
    aspiracao?: { doadoras: number; oocitos: number; media: number };
  };
  estoque: {
    doadoras: number;
    doses_semen: number;
    embrioes_congelados: number;
  };
  fazendas: Array<{ nome: string; receptoras: number }>;
}

// ============================================================
// Formatar dados para o prompt do usuário
// ============================================================
function formatUserPrompt(body: DailySummaryRequest): string {
  const lines: string[] = [];

  lines.push(`Cliente: ${body.cliente_nome}`);
  lines.push(`Data: ${body.data}`);
  lines.push(`Hora: ${body.hora}h`);
  lines.push('');

  // Receptoras
  const r = body.receptoras;
  lines.push(`REBANHO DE RECEPTORAS:`);
  lines.push(`Total: ${r.total}`);
  lines.push(`Prenhes: ${r.prenhes}`);
  lines.push(`Servidas (aguardando diagnóstico): ${r.servidas}`);
  lines.push(`Em protocolo: ${r.protocoladas}`);
  lines.push(`Vazias: ${r.vazias}`);
  if (r.total > 0) {
    lines.push(`Taxa de prenhez geral: ${Math.round((r.prenhes / r.total) * 100)}%`);
  }
  lines.push('');

  // Próximos serviços
  if (body.proximos_servicos.length > 0) {
    lines.push('PRÓXIMOS SERVIÇOS PENDENTES:');
    body.proximos_servicos.forEach(s => {
      const urgText = s.urgente ? ' [URGENTE]' : '';
      const diasText = s.dias_mais_urgente <= 0
        ? `já passou ${Math.abs(s.dias_mais_urgente)} dias da janela ideal`
        : `faltam ${s.dias_mais_urgente} dias`;
      lines.push(`${s.label}: ${s.total} receptoras (${s.prontas} prontas, ${diasText})${urgText}`);
    });
    lines.push('');
  }

  // Últimos resultados
  const u = body.ultimos_resultados;
  if (u.te || u.dg || u.sexagem || u.aspiracao) {
    lines.push('ÚLTIMOS RESULTADOS:');
    if (u.te) {
      lines.push(`Última transferência: ${u.te.sincronizadas} sincronizadas, ${u.te.servidas} receberam embrião (${u.te.taxa}% aproveitamento)`);
    }
    if (u.dg) {
      lines.push(`Último diagnóstico de prenhez: ${u.dg.total} examinadas, ${u.dg.prenhes} prenhes (${u.dg.taxa}%)`);
    }
    if (u.sexagem) {
      lines.push(`Última sexagem: ${u.sexagem.total} examinadas, ${u.sexagem.femeas} fêmeas, ${u.sexagem.machos} machos, ${u.sexagem.perdas} perdas`);
    }
    if (u.aspiracao) {
      lines.push(`Última aspiração: ${u.aspiracao.doadoras} doadoras, ${u.aspiracao.oocitos} óvulos coletados (média ${u.aspiracao.media} por doadora)`);
    }
    lines.push('');
  }

  // Estoque
  const e = body.estoque;
  if (e.doadoras > 0 || e.doses_semen > 0 || e.embrioes_congelados > 0) {
    lines.push('ESTOQUE:');
    if (e.doadoras > 0) lines.push(`Doadoras: ${e.doadoras}`);
    if (e.doses_semen > 0) lines.push(`Doses de sêmen: ${e.doses_semen}`);
    if (e.embrioes_congelados > 0) lines.push(`Embriões congelados: ${e.embrioes_congelados}`);
    lines.push('');
  }

  // Fazendas
  if (body.fazendas.length > 0) {
    lines.push('FAZENDAS:');
    body.fazendas.forEach(f => {
      lines.push(`${f.nome}: ${f.receptoras} receptoras`);
    });
  }

  return lines.join('\n');
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
    // Auth: JWT is validated by Supabase gateway automatically
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    const body: DailySummaryRequest = await req.json();

    // Validação básica
    if (!body.cliente_id || !body.cliente_nome || !body.data) {
      return new Response(
        JSON.stringify({ success: false, error: 'cliente_id, cliente_nome e data são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase client com service_role
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // API Key do Gemini (tabela de secrets com fallback para env var)
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

    // Formatar prompt do usuário
    const userPrompt = formatUserPrompt(body);

    // Chamar Gemini Flash
    const modelName = 'gemini-2.5-flash-lite';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: GENE_SYSTEM_PROMPT }],
        },
        contents: [{
          parts: [{ text: userPrompt }],
        }],
        generation_config: {
          temperature: 0.8,
          max_output_tokens: 2048,
          response_mime_type: 'application/json',
          response_schema: {
            type: 'OBJECT',
            properties: {
              saudacao: { type: 'STRING', description: 'Saudação calorosa com nome do cliente. 1 frase.' },
              rebanho: { type: 'STRING', description: 'Situação do rebanho, números e urgências. 2-3 frases.' },
              destaques: { type: 'STRING', description: 'Destaques positivos ou próximos passos. 2-3 frases.' },
              incentivo: { type: 'STRING', description: 'Frase de incentivo ou sabedoria rural. 1 frase.' },
            },
            required: ['saudacao', 'rebanho', 'destaques', 'incentivo'],
          },
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini API erro (${geminiResp.status}): ${errText.substring(0, 300)}`);
    }

    const geminiData = await geminiResp.json();
    const candidate = geminiData?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;

    console.log(`[daily-summary] finishReason=${finishReason}, rawLen=${rawText?.length || 0}`);

    if (!rawText) {
      throw new Error(`Gemini resposta vazia (finishReason: ${finishReason})`);
    }

    // Parse JSON estruturado e junta em parágrafos
    let summaryText: string;
    try {
      const parsed = JSON.parse(rawText);
      const parts = [parsed.saudacao, parsed.rebanho, parsed.destaques, parsed.incentivo]
        .filter(Boolean)
        .map((s: string) => s.trim());
      summaryText = parts.join('\n\n');
    } catch {
      // Fallback: usa o texto raw se o JSON falhar
      summaryText = rawText;
    }

    if (!summaryText || summaryText.length < 10) {
      throw new Error('Gemini retornou resumo muito curto');
    }

    // Upsert no cache
    const generatedAt = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('cliente_daily_summaries')
      .upsert(
        {
          cliente_id: body.cliente_id,
          summary_date: body.data,
          summary_text: summaryText,
          generated_at: generatedAt,
        },
        { onConflict: 'cliente_id,summary_date' }
      );

    if (upsertError) {
      console.error('Erro ao salvar cache:', upsertError);
      // Não falha — retorna o resumo mesmo sem cache
    }

    return new Response(
      JSON.stringify({ success: true, summary: summaryText, generated_at: generatedAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('daily-summary error:', message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
