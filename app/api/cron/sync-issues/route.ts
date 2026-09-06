import { NextResponse } from 'next/server';
import { syncStortingetIssuesToDb } from '@/lib/stortinget-sync';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const result = await syncStortingetIssuesToDb();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('Cron sync-issues error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
