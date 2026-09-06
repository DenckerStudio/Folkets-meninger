import { NextResponse } from 'next/server';

export type CronAuthFailure = {
  ok: false;
  status: 401 | 503;
  error: string;
};

export type CronAuthSuccess = { ok: true };

export type CronAuthResult = CronAuthSuccess | CronAuthFailure;

export function verifyCronAuth(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return { ok: false, status: 503, error: 'CRON_SECRET is not configured' };
  }

  const provided = request.headers.get('x-cron-secret')?.trim();
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true };
}

export function cronAuthResponse(result: CronAuthFailure) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
