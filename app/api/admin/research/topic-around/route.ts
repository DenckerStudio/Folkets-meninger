import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import {
  resolveTopicAroundFromCluster,
  resolveTopicAroundFromTopic,
} from '@/lib/admin/research/topic-around-context';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import {
  parseTopicAroundDocumentKinds,
  parseTopicAroundPeriod,
  parseTopicAroundSort,
} from '@/lib/search/topic-around-filters';
import { fetchTopicAroundSearch } from '@/lib/search/topic-around-search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (!isTopicAroundSearchEnabled()) {
    return NextResponse.json(
      { ok: false, reason: 'disabled', items: [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const { searchParams } = new URL(request.url);
  const clusterId = searchParams.get('clusterId')?.trim() ?? '';
  const topicId = searchParams.get('topicId')?.trim() ?? '';

  if (!clusterId && !topicId) {
    return NextResponse.json({ error: 'Mangler clusterId eller topicId' }, { status: 400 });
  }
  if (clusterId && topicId) {
    return NextResponse.json({ error: 'Kun én av clusterId og topicId' }, { status: 400 });
  }

  const context = clusterId
    ? await resolveTopicAroundFromCluster(clusterId)
    : await resolveTopicAroundFromTopic(topicId);

  if (!context.ok) {
    return NextResponse.json({ error: 'Fant ikke tema' }, { status: context.status });
  }

  const result = await fetchTopicAroundSearch({
    query: context.query,
    themeLabel: context.themeLabel,
    filters: {
      documentKinds: parseTopicAroundDocumentKinds(searchParams.get('kinds')),
      period: parseTopicAroundPeriod(searchParams.get('period')),
      sort: parseTopicAroundSort(searchParams.get('sort')),
    },
  });

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}