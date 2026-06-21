import { NextResponse } from 'next/server';
import { requireForumAdmin } from '@/lib/forum/admin';
import { getSakPromptMetrics } from '@/lib/forum/sak-prompt-metrics';
import { getSakPromptCoverage } from '@/lib/forum/sak-prompt-candidates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [coverage, metrics] = await Promise.all([getSakPromptCoverage(), getSakPromptMetrics()]);

  return NextResponse.json({ coverage, metrics });
}
