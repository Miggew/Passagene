/**
 * Edge Function: fetch-gemini-insights
 *
 * Central de Inteligência do Dashboard.
 * Gera insights para Notícias, Mercado, Clima e Resumo da Fazenda.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

console.log("Edge Function fetch-gemini-insights loaded");

const PROMPTS = {
  news: `Você é um curador de notícias agropecuárias de elite.
Gere 3 notícias curtas e impactantes para um produtor rural, focadas em mercado e tecnologia (2024-2025).
Formato JSON estrito:
{
  "news": [
    {
      "title": "Título",
      "summary": "Resumo de 2 linhas.",
      "category": "Categoria",
      "sentiment": "positive|neutral|negative",
      "timestamp": "ISO date"
    }
  ]
}`,
  market: `Você é um analista de mercado agropecuário sênior.
Gere cotações realistas e tendências de mercado para hoje (baseado em dados recentes de 2024/2025).
Itens: Boi Gordo (@), Bezerro (cab), Milho (sc 60kg), Soja (sc 60kg).
Formato JSON estrito:
{
  "quotes": [
    {
      "item": "Nome do Item",
      "price": "Valor R$ (ex: 240,50)",
      "variation": número (ex: 1.5 ou -0.8),
      "trend": "up|down",
      "unit": "unidade"
    }
  ]
}`,
  weather: `Você é um meteorologista agrícola.
Gere uma previsão de 3 dias para uma fazenda típica no Centro-Oeste brasileiro, E um insight técnico de manejo.
Formato JSON estrito:
{
  "current": { "temp": 28, "condition": "Ensolarado", "min": 20, "max": 32, "humidity": 60, "wind": 15, "location": "Uberaba, MG" },
  "forecast": [
    { "day": "Seg", "min": 20, "max": 30, "condition": "Chuva", "icon": "rain" } 
  ],
  "insight": "Frase curta com recomendação técnica baseada no clima (ex: evitar manejo nas horas quentes)."
}`,
  farm: `Você é o "Geno", um sistema de IA direto.
Analise os dados da fazenda e forneça um resumo EXTREMAMENTE CURTO (máximo de 8 a 12 palavras) do status principal. Nada de enrolação. Ex: "75% de prenhez (ótimo). 12 prontas para TE."
Dados: {{DATA_CONTEXT}}
Formato JSON estrito:
{
  "analysis": "Seu resumo ultra-curto aqui.",
  "status": "positive|warning|alert"
}`
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Auth: validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { type, data: contextData } = await req.json();

    if (!PROMPTS[type]) throw new Error('Tipo inválido');

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      const { data: secretRow } = await supabase
        .from('embryo_score_secrets')
        .select('key_value')
        .eq('key_name', 'GEMINI_API_KEY')
        .maybeSingle();
      if (secretRow?.key_value) geminiApiKey = secretRow.key_value;
    }

    if (!geminiApiKey) throw new Error('API Key não encontrada');

    // Preparar Prompt
    let finalPrompt = PROMPTS[type];
    if (type === 'farm' && contextData) {
      finalPrompt = finalPrompt.replace('{{DATA_CONTEXT}}', JSON.stringify(contextData));
    }

    const modelName = 'gemini-2.5-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: finalPrompt }] },
        contents: [{ parts: [{ text: "Gere o JSON agora." }] }],
        generation_config: { response_mime_type: 'application/json' }
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const result = await response.json();
    const rawJSON = result.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawJSON);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
