// Edge Function: embryo-analyze v8 — Awaits Cloud Run with timeout
// Fetches job context, calls Cloud Run /analyze with 4-min timeout.
// If Cloud Run fails or times out, marks the job as 'failed'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLOUD_RUN_URL = 'https://embryoscore-pipeline-63493118456.us-central1.run.app';
const PIPELINE_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes (Edge Function limit ~5min)

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let queue_id: string | undefined;

  try {
    // Auth: JWT is validated by Supabase gateway automatically
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    queue_id = body.queue_id;
    if (!queue_id) return errorResponse('queue_id is required', 400);

    // ─── 1. Fetch job (validate existence + idempotency) ──
    const { data: existingJob, error: jobCheckErr } = await supabase
      .from('embryo_analysis_queue')
      .select('status, started_at')
      .eq('id', queue_id)
      .single();

    if (jobCheckErr || !existingJob) {
      return errorResponse(`Job not found: ${queue_id}`, 404);
    }

    if (existingJob.status === 'processing' && existingJob.started_at) {
      const elapsed = Date.now() - new Date(existingJob.started_at).getTime();
      if (elapsed < 5 * 60 * 1000) {
        return jsonResponse({ message: 'Job already processing', queue_id });
      }
      // If >5min stuck in processing, allow re-trigger (stale job recovery)
      console.warn(`Re-triggering stale job ${queue_id} (stuck ${Math.round(elapsed / 1000)}s)`);
    }

    if (existingJob.status === 'completed') {
      return jsonResponse({ message: 'Job already completed', queue_id });
    }

    // ─── 2. Mark as processing ────────────────────────
    await supabase
      .from('embryo_analysis_queue')
      .update({ status: 'processing', started_at: new Date().toISOString(), error_message: null })
      .eq('id', queue_id);

    // ─── 3. Fetch job context ─────────────────────────
    const { data: job, error: jobErr } = await supabase
      .from('embryo_analysis_queue')
      .select('*, lote_fiv_acasalamento_id, media_id, expected_count')
      .eq('id', queue_id)
      .single();
    if (jobErr || !job) throw new Error(`Job not found: ${jobErr?.message}`);

    const { data: media, error: mediaErr } = await supabase
      .from('acasalamento_embrioes_media')
      .select('arquivo_path')
      .eq('id', job.media_id)
      .single();
    if (mediaErr || !media) throw new Error(`Media not found: ${mediaErr?.message}`);

    // ─── 4. Get config (API key, model, prompt) ──────
    const { data: secretRow } = await supabase
      .from('embryo_score_secrets')
      .select('gemini_api_key')
      .limit(1)
      .single();
    const geminiApiKey = secretRow?.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('Gemini API key not configured');

    const { data: configRow } = await supabase
      .from('embryo_score_config')
      .select('calibration_prompt, model_name')
      .limit(1)
      .maybeSingle();

    // ─── 5. Generate signed URL (1h for large videos) ─
    const { data: signed, error: signErr } = await supabase.storage
      .from('embryo-videos')
      .createSignedUrl(media.arquivo_path, 3600);
    if (signErr || !signed?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);

    // ─── 6. Call Cloud Run with timeout ───────────────
    const PIPELINE_URL = Deno.env.get('EMBRYOSCORE_PIPELINE_URL') || DEFAULT_CLOUD_RUN_URL;
    console.log(`Calling pipeline: ${PIPELINE_URL}/analyze (timeout: ${PIPELINE_TIMEOUT_MS / 1000}s)`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS);

    try {
      const pipelineResp = await fetch(`${PIPELINE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          video_url: signed.signedUrl,
          job_id: queue_id,
          expected_count: job.expected_count || 0,
          bboxes: job.manual_bboxes || null,
          gemini_api_key: geminiApiKey,
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          supabase_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          prompt: configRow?.calibration_prompt || null,
          model_name: configRow?.model_name || 'gemini-2.5-flash',
          lote_fiv_acasalamento_id: job.lote_fiv_acasalamento_id,
          media_id: job.media_id,
          embryo_offset: job.embryo_offset || 0,
        }),
      });

      if (!pipelineResp.ok) {
        const errText = await pipelineResp.text().catch(() => 'no body');
        throw new Error(`Cloud Run ${pipelineResp.status}: ${errText.slice(0, 500)}`);
      }

      // Cloud Run succeeded — it already saved scores to DB and updated queue status
      const result = await pipelineResp.json().catch(() => ({}));
      console.log(`Pipeline completed for ${queue_id}: ${result.embryos?.length ?? 0} embryos`);

      return jsonResponse({
        success: true,
        message: 'Analysis completed',
        queue_id,
        embryo_count: result.embryos?.length ?? 0,
      });

    } catch (fetchErr: unknown) {
      // Cloud Run failed, timed out, or OOM'd — mark job as failed
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError';
      const reason = isTimeout
        ? `Pipeline timeout (${PIPELINE_TIMEOUT_MS / 1000}s)`
        : (fetchErr instanceof Error ? fetchErr.message : String(fetchErr));

      console.error(`Pipeline failed for ${queue_id}: ${reason}`);

      await supabase.from('embryo_analysis_queue').update({
        status: 'failed',
        error_message: reason.slice(0, 1000),
        completed_at: new Date().toISOString(),
      }).eq('id', queue_id);

      return errorResponse(`Analysis failed: ${reason}`);
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('embryo-analyze error:', message);

    if (queue_id) {
      try {
        const sb = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await sb.from('embryo_analysis_queue').update({
          status: 'failed',
          error_message: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        }).eq('id', queue_id);
      } catch (dbErr) {
        console.error('Failed to update job status:', dbErr);
      }
    }

    return errorResponse(message);
  }
});
