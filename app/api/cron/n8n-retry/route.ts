import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import { retryPendingN8nJobs } from '@/lib/n8n/retry-pending';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const result = await retryPendingN8nJobs();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Cron n8n-retry error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
