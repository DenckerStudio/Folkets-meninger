import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { trustedClientIp } from '@/lib/trusted-client-ip';
import { getSakPageBundle } from '@/lib/stortinget';
import { fetchSimilarSaker } from '@/lib/sak/similar-issues';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import {
  resolvePublicTopicAroundSakSection,
  TOPIC_AROUND_PUBLIC_MIN_ITEMS,
} from '@/lib/search/topic-around-public';
import { fetchTopicAroundSearchWithTimeout } from '@/lib/search/topic-around-search';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const ipRate = await checkRateLimit(
    `sak-topic-around:ip:${trustedClientIp(request) || 'unknown'}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  if (!isTopicAroundSearchEnabled()) {
    return NextResponse.json(
      { ok: true, items: [], showPublic: false, minPublicItems: TOPIC_AROUND_PUBLIC_MIN_ITEMS },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const { id } = await params;
  const issueId = id.trim();
  if (!issueId) {
    return NextResponse.json({ error: 'Ugyldig sak' }, { status: 400 });
  }

  const bundle = await getSakPageBundle(issueId);
  if (!bundle) {
    return NextResponse.json({ error: 'Fant ikke sak' }, { status: 404 });
  }

  const detail = bundle.detail;
  const title =
    (typeof detail.korttittel === 'string' && detail.korttittel.trim()) ||
    (typeof detail.tittel === 'string' && detail.tittel.trim()) ||
    bundle.sak.title?.trim() ||
    issueId;
  const summary =
    (typeof detail.sammendrag === 'string' && detail.sammendrag.trim()) ||
    (typeof detail.innstillingstekst === 'string' && detail.innstillingstekst.trim()) ||
    null;

  const similarSaker = await fetchSimilarSaker(issueId);
  const excludeIssueIds = [issueId, ...similarSaker.map((item) => item.id)];

  const result = await fetchTopicAroundSearchWithTimeout({
    query: buildTopicAroundSearchQuery({ title, summary }),
    themeLabel: title,
    filters: { excludeIssueIds },
  });

  const items = resolvePublicTopicAroundSakSection({
    result,
    issueId,
    excludeIssueIds,
  });

  return NextResponse.json(
    {
      ok: true,
      items: items ?? [],
      showPublic: Boolean(items?.length),
      minPublicItems: TOPIC_AROUND_PUBLIC_MIN_ITEMS,
    },
    {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    },
  );
}