import { checkRateLimitMemory, type RateLimitResult } from '@/lib/rate-limit-memory';

export type { RateLimitResult };

function parseRpcResult(data: unknown, limit: number): RateLimitResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as { ok?: boolean; remaining?: number; retryAfterSeconds?: number };
  if (row.ok === true) {
    const remaining =
      typeof row.remaining === 'number' ? row.remaining : Math.max(0, limit - 1);
    return { ok: true, remaining };
  }
  if (row.ok === false) {
    const retry =
      typeof row.retryAfterSeconds === 'number' && row.retryAfterSeconds > 0
        ? row.retryAfterSeconds
        : 1;
    return { ok: false, retryAfterSeconds: retry };
  }
  return null;
}

async function checkRateLimitPostgres(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/check_api_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_bucket_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as unknown;
    return parseRpcResult(data, limit);
  } catch {
    return null;
  }
}

/** Shared store (Postgres) when service role is configured; else in-memory fallback. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const shared = await checkRateLimitPostgres(key, limit, windowMs);
  if (shared) {
    return shared;
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

/** Paths that get write/expensive rate limits (per IP). */
export function getRateLimitPolicy(
  pathname: string,
  method = 'GET',
): { limit: number; windowMs: number } | null {
  if (pathname.startsWith('/api/vote') || pathname.startsWith('/api/stance')) {
    return { limit: 30, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/polls') && method.toUpperCase() === 'POST') {
    return { limit: 10, windowMs: 60_000 };
  }
  if (/^\/api\/sak\/[^/]+\/ai-summary/.test(pathname)) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (/^\/api\/sak\/[^/]+\/impact/.test(pathname)) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (/^\/api\/sak\/[^/]+\/knowledge/.test(pathname)) {
    return { limit: 30, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/opinions')) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/feedback')) {
    return { limit: 8, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/suggestions')) {
    return { limit: 8, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/hearings') && method.toUpperCase() === 'POST') {
    return { limit: 12, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/chat')) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/byok')) {
    return { limit: 20, windowMs: 60_000 };
  }
  if (pathname.startsWith('/api/stemme-plus/checkout') || pathname.startsWith('/api/stemme-plus/portal')) {
    return { limit: 10, windowMs: 60_000 };
  }
  return null;
}
