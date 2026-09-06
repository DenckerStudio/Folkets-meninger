import { NextResponse } from 'next/server';
import { packageReadyCounterProposals } from '@/lib/counter-proposals/service';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const result = await packageReadyCounterProposals();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Cron package-counter-proposals error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
