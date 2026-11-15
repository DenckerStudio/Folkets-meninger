import { NextResponse } from 'next/server';
import { rankUtforskIssuesHybrid } from '@/lib/search/stortinget-issue-ranking';
import { shouldFallbackUtforskToLexicalSearch } from '@/lib/search/utforsk-search-fallback';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().slice(0, 120);

  if (!query) {
    return NextResponse.json(
      { issueIds: null, mode: 'none' as const },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const issueIds = await rankUtforskIssuesHybrid(query, 120);

  return NextResponse.json(
    {
      issueIds,
      mode: shouldFallbackUtforskToLexicalSearch(issueIds) ? ('lexical' as const) : ('hybrid' as const),
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    },
  );
}