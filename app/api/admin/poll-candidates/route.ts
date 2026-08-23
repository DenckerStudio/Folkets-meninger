import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { getSakPollCoverage, listSakPollCandidates } from '@/lib/polls/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [candidates, coverage] = await Promise.all([
    listSakPollCandidates(25),
    getSakPollCoverage(),
  ]);
  return NextResponse.json({ candidates, coverage });
}
