import { NextResponse } from 'next/server';
import { packageReadyOpinionInnspill } from '@/lib/innspill/service';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Packages Folkets meninger opinions whose support threshold has been reached
 * into hearing innspills and fires N8N_HEARING_INNSPILL_WEBHOOK_URL.
 */
export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const result = await packageReadyOpinionInnspill();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Cron package-opinion-innspill error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
