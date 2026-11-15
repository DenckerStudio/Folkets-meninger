import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { trustedClientIp } from '@/lib/trusted-client-ip';
import { getSakPageBundle } from '@/lib/stortinget';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import { fetchTopicAroundSearch } from '@/lib/search/topic-around-search';
import {
  shouldShowPublicTopicAroundSection,
  TOPIC_AROUND_PUBLIC_MIN_ITEMS,
} from '@/lib/search/topic-around-filters';

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
      { ok: false, reason: 'disabled', items: [], minPublicItems: TOPIC_AROUND_PUBLIC_MIN_ITEMS },
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

  const result = await fetchTopicAroundSearch({
    query: buildTopicAroundSearchQuery({ title, summary }),
    themeLabel: title,
    filters: { excludeIssueIds: [issueId] },
  });

  const payload =
    result.ok === true
      ? {
          ...result,
          minPublicItems: TOPIC_AROUND_PUBLIC_MIN_ITEMS,
          showPublic: shouldShowPublicTopicAroundSection(result.items.length),
        }
      : { ...result, minPublicItems: TOPIC_AROUND_PUBLIC_MIN_ITEMS, showPublic: false };

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
  });
}