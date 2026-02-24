/**
 * useJobStatus — Polls embryo_analysis_queue for real-time status.
 * Stops polling once status is 'completed' or 'failed'.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface JobStatus {
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export function useJobStatus(queueId: string | null) {
  return useQuery({
    queryKey: ['job-status', queueId],
    enabled: !!queueId,
    queryFn: async (): Promise<JobStatus> => {
      const { data, error } = await supabase
        .from('embryo_analysis_queue')
        .select('status, started_at, completed_at')
        .eq('id', queueId!)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 3000;
    },
  });
}

/** Formats elapsed seconds as M:SS */
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
