import { NextResponse } from 'next/server';
import { packageReadyCounterProposals } from '@/lib/counter-proposals/service';

export const dynamic = 'force-dynamic';

function assertCronAuth(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new Error('CRON_SECRET is not configured');
  }
  const provided = request.headers.get('x-cron-secret');
  return Boolean(provided && provided === expected);
}

export async function GET(request: Request) {
  try {
    if (!assertCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await packageReadyCounterProposals();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Cron package-counter-proposals error', error);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
