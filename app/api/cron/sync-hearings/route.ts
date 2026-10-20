import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import { syncStortingetHearingsToDb } from '@/lib/stortinget-hearing-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const result = await syncStortingetHearingsToDb();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('Cron sync-hearings error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
