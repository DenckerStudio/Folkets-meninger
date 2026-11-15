import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  appendSourcesToResearchTopic,
  findMoreSources,
  isWebSearchEnabled,
  parsePublicSearchRequestBody,
  type NormalizedSourceHit,
} from '@/lib/sources';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ topicId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { topicId } = await context.params;
  return NextResponse.json({
    topic_id: topicId?.trim() ?? '',
    web_search_enabled: isWebSearchEnabled(),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = await checkRateLimit(`admin-more-sources:${auth.userId}`, 12, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
      },
    );
  }

  let raw: unknown = null;
  try {
    const text = await request.text();
    raw = text.trim() ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Ugyldig JSON' },
      { status: 400 },
    );
  }

  const parsedBody = parsePublicSearchRequestBody(raw);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.code, message: parsedBody.message },
      { status: 400 },
    );
  }

  const { topicId } = await context.params;
  const id = topicId?.trim() ?? '';
  if (!id) {
    return NextResponse.json({ error: 'not_found', message: 'Fant ikke tema' }, { status: 404 });
  }

  const result = await findMoreSources({ kind: 'topic', topicId: id });
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 422;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    scope: { kind: 'topic', topic_id: id },
    query_built_server_side: true,
    web_search_enabled: result.webSearchEnabled,
    web_search_error: result.webSearchError,
    results: result.results,
  });
}

function parseSelectedSources(raw: unknown): NormalizedSourceHit[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const selected = (raw as { selected?: unknown }).selected;
  if (!Array.isArray(selected)) return null;
  const out: NormalizedSourceHit[] = [];
  for (const item of selected) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const snippet = typeof row.snippet === 'string' ? row.snippet.trim() : '';
    const domain = typeof row.domain === 'string' ? row.domain.trim() : '';
    const sourceType = row.sourceType === 'web' ? 'web' : row.sourceType === 'stortinget' ? 'stortinget' : null;
    if (!url || !title || !sourceType) continue;
    out.push({
      url,
      title,
      snippet: snippet.slice(0, 320),
      domain,
      sourceType,
      publishedAt:
        typeof row.publishedAt === 'string' && row.publishedAt.trim()
          ? row.publishedAt.trim()
          : undefined,
    });
  }
  return out.length > 0 ? out : [];
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = await checkRateLimit(`admin-more-sources-save:${auth.userId}`, 20, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Ugyldig JSON' }, { status: 400 });
  }

  if (payload && typeof payload === 'object') {
    for (const key of ['q', 'query', 'search'] as const) {
      if (key in (payload as Record<string, unknown>)) {
        return NextResponse.json(
          {
            error: 'invalid_body',
            message: 'Ugyldig forespørsel: søketekst må ikke sendes fra klienten',
          },
          { status: 400 },
        );
      }
    }
  }

  const selected = parseSelectedSources(payload);
  if (!selected) {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Velg minst én kilde' },
      { status: 400 },
    );
  }

  const { topicId } = await context.params;
  const id = topicId?.trim() ?? '';
  const saved = await appendSourcesToResearchTopic(id, selected);
  if (!saved.ok) {
    const status = saved.code === 'not_found' ? 404 : 422;
    return NextResponse.json({ error: saved.code, message: saved.message }, { status });
  }

  return NextResponse.json({
    topic_id: id,
    added: saved.added,
    skipped: saved.skipped,
  });
}