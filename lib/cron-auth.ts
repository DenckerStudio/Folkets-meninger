import { NextResponse } from 'next/server';
import type { CronAuthFailure } from '@/lib/cron-auth-verify';

export type { CronAuthFailure, CronAuthResult, CronAuthSuccess } from '@/lib/cron-auth-verify';
export { verifyCronAuth } from '@/lib/cron-auth-verify';

export function cronAuthResponse(result: CronAuthFailure) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
