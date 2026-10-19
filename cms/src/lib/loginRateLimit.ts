type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 30;

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const key = ip.trim() || 'unknown';
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (existing.count >= MAX_ATTEMPTS_PER_IP) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true };
}

/** Test helper — clears in-memory state between unit tests. */
export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}
