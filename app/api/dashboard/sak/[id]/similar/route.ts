import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { trustedClientIp } from '@/lib/trusted-client-ip';
import { getSakPageBundle } from '@/lib/stortinget';
import { dedupeSimilarSaker } from '@/lib/sak/similar-issues-dedupe';
import { loadSimilarSakerWithStatus } from '@/lib/sak/similar-issues-load';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const ipRate = await checkRateLimit(
    `sak-similar:ip:${trustedClientIp(request) || 'unknown'}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!ipRate.ok) {
    return NextResponse.json(
      { status: 'error', error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  const { id } = await params;
  const issueId = id.trim();
  if (!issueId) {
    return NextResponse.json({ status: 'error', error: 'Ugyldig sak' }, { status: 400 });
  }

  const bundle = await getSakPageBundle(issueId);
  if (!bundle) {
    return NextResponse.json({ status: 'error', error: 'Fant ikke sak' }, { status: 404 });
  }

  const relaterteIds = (bundle.detail.sak_relasjon_liste ?? []).flatMap(
    (rel: { relatert_sak?: { id?: unknown } }) => {
      const relId = rel.relatert_sak?.id;
      return relId != null ? [String(relId)] : [];
    },
  );

  const loaded = await loadSimilarSakerWithStatus(issueId);
  if (loaded.status === 'error') {
    return NextResponse.json(
      { status: 'error' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const items = dedupeSimilarSaker(loaded.items, issueId, relaterteIds);

  return NextResponse.json(
    { status: 'ok', items },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}