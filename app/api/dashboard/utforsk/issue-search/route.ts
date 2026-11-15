import { NextResponse } from 'next/server';
import { rankUtforskIssuesHybrid } from '@/lib/search/stortinget-issue-ranking';
import {
  normalizeUtforskIssueSearchQuery,
  utforskIssueSearchRateLimitKey,
  UTFORSK_ISSUE_SEARCH_IP_LIMIT,
  UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS,
} from '@/lib/search/utforsk-issue-search-api';
import { shouldFallbackUtforskToLexicalSearch } from '@/lib/search/utforsk-search-fallback';
import { checkRateLimit } from '@/lib/rate-limit';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ipRate = await checkRateLimit(
    utforskIssueSearchRateLimitKey(trustedClientIp(request)),
    UTFORSK_ISSUE_SEARCH_IP_LIMIT,
    UTFORSK_ISSUE_SEARCH_IP_WINDOW_MS,
  );
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const { query, shouldSearch } = normalizeUtforskIssueSearchQuery(searchParams.get('q'));

  if (!shouldSearch) {
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