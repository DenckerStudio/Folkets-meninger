type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

/** Paths that get write/expensive rate limits (per IP). */
export function getRateLimitPolicy(pathname: string): { limit: number; windowMs: number } | null {
  if (pathname.startsWith('/api/vote')) {
    return { limit: 30, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/forum')) {
    return { limit: 60, windowMs: 60_000 };
  }
  if (/^\/api\/sak\/[^/]+\/ai-summary/.test(pathname)) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/forum/context-search')) {
    return { limit: 40, windowMs: 60_000 };
  }
  return null;
}
