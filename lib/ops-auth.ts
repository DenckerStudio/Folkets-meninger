import { timingSafeEqual } from 'node:crypto';
import type { CronAuthFailure, CronAuthResult } from '@/lib/cron-auth-verify';

function safeEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Shared secret for n8n → app ops routes (`x-cron-secret`, same as CRON_SECRET). */
export function verifyOpsSecret(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return { ok: false, status: 503, error: 'CRON_SECRET is not configured' };
  }

  const provided = request.headers.get('x-cron-secret')?.trim();
  if (!provided || !safeEqual(expected, provided)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true };
}
