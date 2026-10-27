import type { BackfillSupabase } from './supabase-client';
import {
  createTier0ProbeCacheState,
  hasTier0FromRpcRows,
  isTier0ProbeCacheFresh,
  recordTier0ProbeSuccess,
  resolveTier0ProbeError,
  type Tier0ProbeCacheState,
} from './tier0-probe-cache';

export type CreateCachedTier0ProbeOptions = {
  secrets?: string[];
  log?: (line: string) => void;
  now?: () => number;
};

export function createCachedTier0Probe(
  supabase: BackfillSupabase,
  options: CreateCachedTier0ProbeOptions = {},
): () => Promise<boolean> {
  const state: Tier0ProbeCacheState = createTier0ProbeCacheState();
  const log = options.log ?? ((line: string) => console.log(line));
  const secrets = options.secrets ?? [];
  const now = options.now ?? (() => Date.now());

  return async (): Promise<boolean> => {
    const nowMs = now();
    if (isTier0ProbeCacheFresh(state, nowMs)) {
      return state.cachedHasTier0!;
    }

    const { data, error } = await supabase.rpc('n8n_list_v2_priority_issues', {
      p_tier: 0,
      p_limit: 1,
      p_worker_index: 0,
      p_worker_count: 1,
    });

    if (error) {
      return resolveTier0ProbeError(state, error, log, secrets);
    }

    return recordTier0ProbeSuccess(state, hasTier0FromRpcRows(data), nowMs);
  };
}
