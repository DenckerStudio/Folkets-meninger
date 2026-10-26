import type { ResolvedEndpoint } from './endpoints';

export type ClaimLane = 'fast' | 'background';

/** Fast (tier 0) only on primary; background yields while tier 0 backlog exists. */
export function selectClaimLane(
  endpoint: ResolvedEndpoint,
  tier0Pending: boolean,
): ClaimLane | null {
  const canFast = endpoint.primary && endpoint.lanes.includes('fast');
  const canBackground = endpoint.lanes.includes('background');

  if (tier0Pending) {
    if (canFast) return 'fast';
    return null;
  }

  if (canBackground) return 'background';
  return null;
}
