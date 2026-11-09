import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/gate';
import { parseClientResearchRequestId } from '@/lib/admin/research/request-id';
import {
  RESEARCH_TOPIC_API_ERROR_CODES,
  getResearchTopicById,
  requestResearchTopicBrief,
} from '@/lib/admin/research/topic-service';
import type { ResearchTopicSourceKind } from '@/lib/admin/research/topic-brief-schema';
import { RESEARCH_TOPIC_SOURCE_KINDS } from '@/lib/admin/research/topic-brief-schema';

export const dynamic = 'force-dynamic';

function parseSourceKind(value: unknown): ResearchTopicSourceKind | null {
  if (typeof value !== 'string') return null;
  return (RESEARCH_TOPIC_SOURCE_KINDS as readonly string[]).includes(value)
    ? (value as ResearchTopicSourceKind)
    : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON-body' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const sourceKind = parseSourceKind(payload.source_kind);
  const requestId = parseClientResearchRequestId(body);
  const title = typeof payload.title === 'string' ? payload.title.trim() : null;
  const clusterId =
    typeof payload.cluster_id === 'string' ? payload.cluster_id.trim() : null;
  const redditSignalId =
    typeof payload.reddit_signal_id === 'string' ? payload.reddit_signal_id.trim() : null;
  const force = payload.force === true;

  if (!sourceKind || !requestId) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }
  if (sourceKind === 'cluster' && !clusterId) {
    return NextResponse.json({ error: 'cluster_id mangler' }, { status: 400 });
  }
  if (sourceKind === 'cluster' && !title) {
    return NextResponse.json({ error: 'title mangler' }, { status: 400 });
  }
  if (sourceKind === 'reddit' && !redditSignalId) {
    return NextResponse.json({ error: 'reddit_signal_id mangler' }, { status: 400 });
  }

  const result = await requestResearchTopicBrief({
    sourceKind,
    clusterId,
    redditSignalId,
    title,
    requestId,
    requestedBy: auth.userId,
    force,
  });

  if (!result.ok) {
    if (result.code === RESEARCH_TOPIC_API_ERROR_CODES.requestConflict) {
      return NextResponse.json(
        { error: result.code, message: 'request_id er i konflikt med annen rad' },
        { status: 409 },
      );
    }
    if (result.code === 'not_found') {
      return NextResponse.json(
        { error: result.code, message: result.message ?? 'Fant ikke raden' },
        { status: 404 },
      );
    }
    if (typeof result.message === 'string' && result.httpStatus) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: result.httpStatus },
      );
    }
    return NextResponse.json(
      { error: 'db_error', message: 'Kunne ikke starte tema-brief' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    topic_id: result.topicId,
    request_id: result.requestId,
    status: result.status,
    publishable: result.publishable,
    enqueue: result.enqueue,
    created: result.created,
  });
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const topicId = url.searchParams.get('topic_id')?.trim();
  if (!topicId) {
    return NextResponse.json({ error: 'topic_id mangler' }, { status: 400 });
  }

  const topic = await getResearchTopicById(topicId);
  if (!topic) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    topic_id: topic.id,
    status: topic.status,
    request_id: topic.request_id,
    publishable: topic.publishable,
    blocking_reason: topic.blocking_reason,
    error: topic.error,
    updated_at: topic.updated_at,
    title: topic.title,
    output: topic.status === 'done' ? topic.output : null,
    source_kind: topic.source_kind,
    reddit_signal_id: topic.reddit_signal_id,
    subreddit: topic.subreddit,
  });
}
