import { safeErrorMessage } from './secrets';

export const TIER0_PROBE_CACHE_TTL_MS = 60_000;

export type Tier0ProbeCacheState = {
  cachedAtMs: number | null;
  cachedHasTier0: boolean | null;
};

export function createTier0ProbeCacheState(): Tier0ProbeCacheState {
  return { cachedAtMs: null, cachedHasTier0: null };
}

export function isTier0ProbeCacheFresh(
  state: Tier0ProbeCacheState,
  nowMs: number,
  ttlMs = TIER0_PROBE_CACHE_TTL_MS,
): boolean {
  if (state.cachedAtMs === null || state.cachedHasTier0 === null) {
    return false;
  }
  return nowMs - state.cachedAtMs < ttlMs;
}

export function recordTier0ProbeSuccess(
  state: Tier0ProbeCacheState,
  hasTier0: boolean,
  nowMs: number,
): boolean {
  state.cachedAtMs = nowMs;
  state.cachedHasTier0 = hasTier0;
  return hasTier0;
}

export function resolveTier0ProbeError(
  state: Tier0ProbeCacheState,
  error: unknown,
  log: (line: string) => void,
  secrets: string[] = [],
): boolean {
  log(`[backfill-v2] tier0-probe feilet: ${safeErrorMessage(error, secrets)}`);
  return state.cachedHasTier0 ?? false;
}

export function hasTier0FromRpcRows(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}
