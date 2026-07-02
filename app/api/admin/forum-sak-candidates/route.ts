import { NextResponse } from 'next/server';
import { requireForumAdmin } from '@/lib/forum/admin';
import {
  getSakPromptCoverage,
  listSakPromptCandidates,
} from '@/lib/forum/sak-prompt-candidates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [coverage, candidates] = await Promise.all([
    getSakPromptCoverage(),
    listSakPromptCandidates(),
  ]);

  return NextResponse.json({ coverage, candidates });
}
