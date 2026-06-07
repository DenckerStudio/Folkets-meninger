import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireForumAdmin } from '@/lib/forum/admin';
import {
  CLUSTER_SCOUT_QUEUE_STATUSES,
  isResearchClusterStatus,
  type ResearchClusterStatus,
} from '@/lib/forum/research-cluster-status';

export const dynamic = 'force-dynamic';

type ClusterRow = {
  id: string;
  title: string;
  discovery_rationale: string | null;
  topic_tags: string[];
  politics_score: number;
  source_count: number;
  status: ResearchClusterStatus;
  created_at: string;
  scout_metadata?: Record<string, unknown> | null;
  forum_research_articles?: {
    id: string;
    title: string;
    url: string;
    outlet: string | null;
    published_at: string | null;
    is_primary: boolean;
    sort_order: number;
    source_payload?: { fetch_status?: string };
  }[];
};

export async function GET(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const statusParam =
    searchParams.get('status') || CLUSTER_SCOUT_QUEUE_STATUSES.join(',');
  const statuses = statusParam.split(',').map((s) => s.trim());
  const invalid = statuses.filter((s) => !isResearchClusterStatus(s));
  if (invalid.length) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('forum_research_clusters')
    .select(
      `id, title, discovery_rationale, topic_tags, politics_score, source_count, status, created_at, scout_metadata,
       forum_research_articles (id, title, url, outlet, published_at, is_primary, sort_order, source_payload)`,
    )
    .in('status', statuses)
    .order('politics_score', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente saker' }, { status: 500 });
  }

  const clusters = (data || []).map((row) => {
    const articles = Array.isArray(row.forum_research_articles)
      ? [...row.forum_research_articles].sort((a, b) => a.sort_order - b.sort_order)
      : [];
    return { ...row, forum_research_articles: articles };
  }) as ClusterRow[];

  return NextResponse.json({ clusters });
}

export async function PATCH(request: Request) {
  const auth = await requireForumAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const action = body.action as string;
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => String(id)).filter(Boolean)
    : body.id
      ? [String(body.id)]
      : [];

  if (!ids.length) {
    return NextResponse.json({ error: 'Mangler id' }, { status: 400 });
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Ugyldig handling' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const targetStatus: ResearchClusterStatus = action === 'approve' ? 'accepted' : 'rejected';

  const { data: rows, error: fetchError } = await service
    .from('forum_research_clusters')
    .select('id, status')
    .in('id', ids);

  if (fetchError) {
    return NextResponse.json({ error: 'Kunne ikke hente saker' }, { status: 500 });
  }

  const eligible = (rows || []).filter((r) =>
    CLUSTER_SCOUT_QUEUE_STATUSES.includes(r.status as ResearchClusterStatus),
  );
  if (!eligible.length) {
    return NextResponse.json(
      { error: 'Ingen saker i køen (kun ventende saker kan behandles)' },
      { status: 409 },
    );
  }

  const eligibleIds = eligible.map((r) => r.id);
  const { error: updateError } = await service
    .from('forum_research_clusters')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .in('id', eligibleIds);

  if (updateError) {
    return NextResponse.json({ error: 'Kunne ikke oppdatere' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    updated: eligibleIds.length,
    skipped: ids.length - eligibleIds.length,
    status: targetStatus,
  });
}
