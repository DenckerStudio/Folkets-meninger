import { NextResponse } from 'next/server';
import { syncStortingetIssuesToDb } from '@/lib/stortinget-sync';

export const dynamic = 'force-dynamic';

function assertCronAuth(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new Error('CRON_SECRET is not configured');
  }
  const provided = request.headers.get('x-cron-secret');
  if (!provided || provided !== expected) {
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  try {
    if (!assertCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncStortingetIssuesToDb();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('Cron sync-issues error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
