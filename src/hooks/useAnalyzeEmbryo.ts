/**
 * useAnalyzeEmbryo — trigger EmbryoScore analysis via Cloud Run directly.
 *
 * Replaces all `supabase.functions.invoke('embryo-analyze')` calls.
 * Uses fetchWithRetry (same pattern as OCR) to handle cold-start 503s.
 * If Cloud Run fails after retries, marks the queue job as 'failed' in DB.
 */

import { PIPELINE_URL, fetchWithRetry } from '@/lib/cloudRunOcr';
import { supabase } from '@/lib/supabase';

const API_KEY = import.meta.env.VITE_PIPELINE_API_KEY || '';

/**
 * Trigger analysis for a queue job. NOT fire-and-forget:
 * - Waits for Cloud Run to accept the request (not for full completion)
 * - Retries on 503 (cold start) with exponential backoff
 * - On total failure, marks queue as 'failed' so it never stays stuck in 'pending'
 *
 * @returns { success: true } or { success: false, error: string }
 */
export async function triggerAnalysis(
  queueId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetchWithRetry(
      `${PIPELINE_URL}/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
        },
        body: JSON.stringify({ queue_id: queueId }),
      },
      3, // retries
    );

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const errorMsg = `Cloud Run ${resp.status}: ${body.slice(0, 500)}`;

      // Mark as failed so it doesn't stay stuck
      await supabase
        .from('embryo_analysis_queue')
        .update({
          status: 'failed',
          error_message: errorMsg.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Mark as failed on network errors too
    await supabase
      .from('embryo_analysis_queue')
      .update({
        status: 'failed',
        error_message: `Fetch error: ${errorMsg}`.slice(0, 1000),
        completed_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    return { success: false, error: errorMsg };
  }
}
