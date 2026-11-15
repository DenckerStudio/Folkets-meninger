import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  findMoreSources,
  isWebSearchEnabled,
  parsePublicSearchRequestBody,
} from '@/lib/sources';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { issueId } = await context.params;
  return NextResponse.json({
    issue_id: issueId?.trim() ?? '',
    web_search_enabled: isWebSearchEnabled(),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rate = await checkRateLimit(`admin-more-sources-issue:${auth.userId}`, 12, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      { status: 429,
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

  const { issueId } = await context.params;
  const id = issueId?.trim() ?? '';
  if (!id) {
    return NextResponse.json({ error: 'not_found', message: 'Fant ikke sak' }, { status: 404 });
  }

  const result = await findMoreSources({ kind: 'issue', issueId: id });
  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 422;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    scope: { kind: 'issue', issue_id: id },
    query_built_server_side: true,
    web_search_enabled: result.webSearchEnabled,
    web_search_error: result.webSearchError,
    results: result.results,
  });
}