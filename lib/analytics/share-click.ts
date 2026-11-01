import type { RateLimitResult } from '@/lib/rate-limit';

/** Insert a click only when both the visitor IP and the link code are under the cap. */
export function shouldRecordShareClick(
  ipResult: RateLimitResult,
  codeResult: RateLimitResult,
): boolean {
  return ipResult.ok && codeResult.ok;
}
