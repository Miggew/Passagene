/**
 * Edge Function: fetch-news-gemini
 *
 * Busca notícias agronegócio/pecuária e gera resumo com Gemini.
 * Usa a chave de API salva em 'embryo_score_secrets'.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const SYSTEM_PROMPT = `Você é um curador de notícias especializado em pecuária de leite e corte, genética bovina e mercado agropecuário.
Sua tarefa é gerar 3 notícias curtas e relevantes para um produtor rural de elite.
As notícias devem ser baseadas em tendências reais e atuais do mercado (simule dados realistas se não tiver acesso à web em tempo real, focado em 2024-2025).

Retorne APENAS um JSON estrito com o seguinte formato:
{
  "news": [
    {
      "title": "Título curto e impactante",
      "summary": "Resumo de 2 linhas sobre a notícia, focando no impacto para o produtor.",
      "category": "Mercado" | "Genética" | "Tecnologia" | "Sanidade",
      "sentiment": "positive" | "neutral" | "negative",
      "timestamp": "ISO string da data"
    }
  ]
}
Gere exatamente 3 notícias.`;

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Buscar API Key do Gemini no banco
        let geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        try {
            const { data: secretRow } = await supabase
                .from('embryo_score_secrets')
                .select('key_value')
                .eq('key_name', 'GEMINI_API_KEY')
                .maybeSingle();
            if (secretRow?.key_value) geminiApiKey = secretRow.key_value;
        } catch {
            console.warn('Falha ao buscar secret do banco');
        }

        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY não configurada');
        }

        // 2. Chamar Gemini
        const modelName = 'gemini-2.0-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ parts: [{ text: "Gere as notícias de hoje para o dashboard." }] }],
                generation_config: {
                    response_mime_type: 'application/json',
                    response_schema: {
                        type: 'OBJECT',
                        properties: {
                            news: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        title: { type: 'STRING' },
                                        summary: { type: 'STRING' },
                                        category: { type: 'STRING' },
                                        sentiment: { type: 'STRING' },
                                        timestamp: { type: 'STRING' }
                                    },
                                    required: ['title', 'summary', 'category']
                                }
                            }
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Gemini error: ${txt}`);
        }

        const data = await response.json();
        const rawJSON = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawJSON) throw new Error('Resposta vazia do Gemini');

        const parsed = JSON.parse(rawJSON);

        return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
