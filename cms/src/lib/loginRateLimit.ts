type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS_PER_IP = 30;
export const MAX_ATTEMPTS_PER_IP_AND_IDENTIFIER = 30;
export const MAX_RATE_LIMIT_MAP_ENTRIES = 10_000;

function ipBucketKey(ip: string): string {
  return `ip:${ip.trim() || 'unknown'}`;
}

function pairBucketKey(ip: string, identifier: string): string {
  const id = identifier.trim() || '_';
  return `pair:${ip.trim() || 'unknown'}|${id}`;
}

function touchBucket(key: string, bucket: Bucket): void {
  if (buckets.has(key)) {
    buckets.delete(key);
  }
  buckets.set(key, bucket);
  while (buckets.size > MAX_RATE_LIMIT_MAP_ENTRIES) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

function checkBucket(key: string, maxAttempts: number): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    touchBucket(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (existing.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  touchBucket(key, existing);
  return { allowed: true };
}

/**
 * Dual buckets: per-IP (all emails) and per-IP+identifier.
 * Prevents one IP from exhausting every account while still scoping abuse per login.
 */
export function checkLoginRateLimit(
  ip: string,
  identifier: string,
): { allowed: boolean; retryAfterSec?: number } {
  const ipLimit = checkBucket(ipBucketKey(ip), MAX_ATTEMPTS_PER_IP);
  if (!ipLimit.allowed) return ipLimit;
  return checkBucket(pairBucketKey(ip, identifier), MAX_ATTEMPTS_PER_IP_AND_IDENTIFIER);
}

/** Test helper — clears in-memory state between unit tests. */
export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}
