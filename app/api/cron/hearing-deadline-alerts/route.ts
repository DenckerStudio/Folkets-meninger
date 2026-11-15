import { NextResponse } from 'next/server';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import { runHearingDeadlineAlerts } from '@/lib/hearing-deadline-alerts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await runHearingDeadlineAlerts({ origin });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('hearing-deadline-alerts cron', error);
    return NextResponse.json({ ok: false, error: 'Cron feilet' }, { status: 500 });
  }
}