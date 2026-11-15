import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';

export function publicAggregateMeetsThreshold(count: number): boolean {
  if (!Number.isFinite(count) || count < 0) return false;
  return count >= MIN_PUBLIC_AGGREGATE_N;
}

/** Whole votes still needed before aggregates may be shown publicly (0 when already sufficient). */
export function publicAggregateVotesRemaining(count: number): number {
  if (!Number.isFinite(count) || count < 0) return MIN_PUBLIC_AGGREGATE_N;
  return Math.max(0, MIN_PUBLIC_AGGREGATE_N - Math.floor(count));
}

/**
 * When below threshold, zero out sensitive breakdown fields while keeping a safe total
 * for internal “votes remaining” messaging (never expose sub-threshold percentages).
 */
export function suppressPublicAggregateBreakdown<T extends { total: number }>(
  counts: T,
  fieldsToClear: (keyof T)[],
): T {
  if (publicAggregateMeetsThreshold(counts.total)) {
    return counts;
  }
  const next = { ...counts };
  for (const key of fieldsToClear) {
    const value = next[key];
    if (typeof value === 'number') {
      (next as Record<string, number>)[key as string] = 0;
    }
  }
  return next;
}