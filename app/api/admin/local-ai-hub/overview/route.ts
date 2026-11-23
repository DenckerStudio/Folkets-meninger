import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import {
  ifNoneMatchAllows304,
  LOCAL_AI_OVERVIEW_CACHE_TTL_MS,
} from '@/lib/admin/local-ai-hub/overview-cache-store';
import {
  loadLocalAiOverviewCached,
  shouldBypassOverviewCacheFromRequest,
} from '@/lib/admin/local-ai-hub/overview-cache';

export const dynamic = 'force-dynamic';

function overviewCacheControl(): string {
  const maxAge = Math.floor(LOCAL_AI_OVERVIEW_CACHE_TTL_MS / 1000);
  return `private, max-age=${maxAge}, must-revalidate`;
}

export async function GET(request: Request) {
  if (!isAdminLocalAiHubEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const bypassCache = shouldBypassOverviewCacheFromRequest(request);
  const { result, etag, fromCache } = await loadLocalAiOverviewCached({ bypassCache });
  const ifNoneMatch = request.headers.get('if-none-match');

  if (ifNoneMatchAllows304(ifNoneMatch, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': overviewCacheControl(),
        'X-Local-Ai-Hub-Overview-Cache': fromCache ? 'HIT' : 'MISS',
      },
    });
  }

  return NextResponse.json(result, {
    headers: {
      ETag: etag,
      'Cache-Control': overviewCacheControl(),
      'X-Local-Ai-Hub-Overview-Cache': fromCache ? 'HIT' : 'MISS',
    },
  });
}