import { getServiceSupabase } from '@/lib/supabase';
import type { ResearchTopicSourceKind, ResearchTopicStatus } from '@/lib/admin/research/topic-brief-schema';
import { postResearchTopicWebhook } from '@/lib/admin/research/topic-webhook';
import { mapResearchWebhookFailure } from '@/lib/admin/research/webhook-errors';
import type {
  ResearchTopicRow,
  ResearchTopicSnapshot,
  ResearchTopicWebhookBody,
} from '@/lib/admin/research/topic-types';
import { RESEARCH_TOPIC_WEBHOOK_KIND } from '@/lib/admin/research/topic-types';

export const RESEARCH_TOPIC_API_ERROR_CODES = {
  requestConflict: 'research_topic_request_conflict',
} as const;

const RESEARCH_TOPIC_STALE_MINUTES = 30;

const TOPIC_SELECT =
  'id, source_kind, cluster_id, reddit_signal_id, title, status, request_id, output, previous_output, publishable, blocking_reason, error, heartbeat_at, started_at, finished_at, created_by, created_at, updated_at, stortinget_issue_id, stortinget_poll_id';

function parseTopicRow(
  raw: Record<string, unknown>,
  redditMeta?: { reddit_id: string | null; subreddit: string | null },
): ResearchTopicRow {
  return {
    id: String(raw.id),
    source_kind: raw.source_kind as ResearchTopicSourceKind,
    cluster_id: raw.cluster_id != null ? String(raw.cluster_id) : null,
    reddit_signal_id: raw.reddit_signal_id != null ? String(raw.reddit_signal_id) : null,
    reddit_id: redditMeta?.reddit_id ?? null,
    subreddit: redditMeta?.subreddit ?? null,
    title: typeof raw.title === 'string' ? raw.title : null,
    status: raw.status as ResearchTopicStatus,
    request_id: String(raw.request_id),
    output: raw.output ?? {},
    previous_output: raw.previous_output ?? {},
    publishable: typeof raw.publishable === 'boolean' ? raw.publishable : null,
    blocking_reason: typeof raw.blocking_reason === 'string' ? raw.blocking_reason : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    heartbeat_at: typeof raw.heartbeat_at === 'string' ? raw.heartbeat_at : null,
    started_at: typeof raw.started_at === 'string' ? raw.started_at : null,
    finished_at: typeof raw.finished_at === 'string' ? raw.finished_at : null,
    created_by: typeof raw.created_by === 'string' ? raw.created_by : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    stortinget_issue_id:
      typeof raw.stortinget_issue_id === 'string' ? raw.stortinget_issue_id : null,
    stortinget_poll_id:
      typeof raw.stortinget_poll_id === 'string' ? raw.stortinget_poll_id : null,
  };
}

export function toResearchTopicSnapshot(row: ResearchTopicRow): ResearchTopicSnapshot {
  return {
    topicId: row.id,
    status: row.status,
    requestId: row.request_id,
    publishable: row.publishable,
    error: row.error,
    updatedAt: row.updated_at,
  };
}

async function loadRedditMetaBySignalIds(
  ids: string[],
): Promise<Record<string, { reddit_id: string; subreddit: string }>> {
  if (ids.length === 0) return {};
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('reddit_signals')
    .select('id, reddit_id, subreddit')
    .in('id', ids);
  const out: Record<string, { reddit_id: string; subreddit: string }> = {};
  for (const row of data ?? []) {
    out[String(row.id)] = {
      reddit_id: String(row.reddit_id),
      subreddit: String(row.subreddit),
    };
  }
  return out;
}

export async function expireStaleResearchTopics(
  minutes: number = RESEARCH_TOPIC_STALE_MINUTES,
): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase.rpc('research_topics_expire_stale', { p_minutes: minutes });
}

export async function getResearchTopicById(topicId: string): Promise<ResearchTopicRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_topics')
    .select(TOPIC_SELECT)
    .eq('id', topicId)
    .maybeSingle();
  if (error || !data) return null;
  let redditMeta: { reddit_id: string | null; subreddit: string | null } | undefined;
  if (data.reddit_signal_id) {
    const map = await loadRedditMetaBySignalIds([String(data.reddit_signal_id)]);
    const meta = map[String(data.reddit_signal_id)];
    redditMeta = meta
      ? { reddit_id: meta.reddit_id, subreddit: meta.subreddit }
      : { reddit_id: null, subreddit: null };
  }
  return parseTopicRow(data as Record<string, unknown>, redditMeta);
}

export async function getResearchTopicSnapshotsBySources(input: {
  clusterIds: string[];
  redditSignalIds: string[];
}): Promise<{
  byClusterId: Record<string, ResearchTopicSnapshot>;
  byRedditSignalId: Record<string, ResearchTopicSnapshot>;
}> {
  const byClusterId: Record<string, ResearchTopicSnapshot> = {};
  const byRedditSignalId: Record<string, ResearchTopicSnapshot> = {};
  if (input.clusterIds.length === 0 && input.redditSignalIds.length === 0) {
    return { byClusterId, byRedditSignalId };
  }

  const supabase = getServiceSupabase();
  const rows: Record<string, unknown>[] = [];

  if (input.clusterIds.length > 0) {
    const { data, error } = await supabase
      .from('research_topics')
      .select(TOPIC_SELECT)
      .in('cluster_id', input.clusterIds);
    if (!error && data) rows.push(...(data as Record<string, unknown>[]));
  }
  if (input.redditSignalIds.length > 0) {
    const { data, error } = await supabase
      .from('research_topics')
      .select(TOPIC_SELECT)
      .in('reddit_signal_id', input.redditSignalIds);
    if (!error && data) rows.push(...(data as Record<string, unknown>[]));
  }

  for (const row of rows) {
    const parsed = parseTopicRow(row);
    const snapshot = toResearchTopicSnapshot(parsed);
    if (parsed.cluster_id) byClusterId[parsed.cluster_id] = snapshot;
    if (parsed.reddit_signal_id) byRedditSignalId[parsed.reddit_signal_id] = snapshot;
  }
  return { byClusterId, byRedditSignalId };
}

export async function buildResearchTopicWebhookBody(input: {
  topicId: string;
  requestId: string;
  sourceKind: ResearchTopicSourceKind;
  clusterId: string | null;
  redditSignalId: string | null;
  title: string | null;
  force: boolean;
}): Promise<ResearchTopicWebhookBody | null> {
  const supabase = getServiceSupabase();

  if (input.sourceKind === 'cluster' && input.clusterId) {
    const { data: cluster, error } = await supabase
      .from('action_clusters')
      .select('id, action_key, action_name, description_nb')
      .eq('id', input.clusterId)
      .maybeSingle();
    if (error || !cluster) return null;

    const summary = typeof cluster.description_nb === 'string' ? cluster.description_nb.trim() : '';
    const context: { action_key: string; summary?: string } = {
      action_key: cluster.action_key,
    };
    if (summary) {
      context.summary = summary;
    }

    const body: ResearchTopicWebhookBody = {
      request_id: input.requestId,
      kind: RESEARCH_TOPIC_WEBHOOK_KIND,
      topic_id: input.topicId,
      source_kind: 'cluster',
      source_ref: input.clusterId,
      title: input.title ?? cluster.action_name,
      context,
      force: input.force,
    };
    return body;
  }

  if (input.sourceKind === 'reddit' && input.redditSignalId) {
    const { data: signal, error } = await supabase
      .from('reddit_signals')
      .select('reddit_id')
      .eq('id', input.redditSignalId)
      .maybeSingle();
    if (error || !signal) return null;

    return {
      request_id: input.requestId,
      kind: RESEARCH_TOPIC_WEBHOOK_KIND,
      topic_id: input.topicId,
      source_kind: 'reddit',
      source_ref: String(signal.reddit_id),
      force: input.force,
    };
  }

  return null;
}

export type RequestResearchTopicBriefInput = {
  sourceKind: ResearchTopicSourceKind;
  clusterId?: string | null;
  redditSignalId?: string | null;
  title: string | null;
  requestId: string;
  requestedBy: string;
  force?: boolean;
};

export async function requestResearchTopicBrief(
  input: RequestResearchTopicBriefInput,
): Promise<
  | {
      ok: true;
      topicId: string;
      requestId: string;
      status: ResearchTopicStatus;
      publishable: boolean | null;
      enqueue: boolean;
      created: boolean;
    }
  | {
      ok: false;
      code: string;
      message?: string;
      httpStatus?: number;
    }
> {
  await expireStaleResearchTopics();

  const supabase = getServiceSupabase();
  const clusterId = input.sourceKind === 'cluster' ? (input.clusterId ?? null) : null;
  const redditSignalId = input.sourceKind === 'reddit' ? (input.redditSignalId ?? null) : null;
  const force = input.force === true;

  let storedTitle = input.title;
  if (input.sourceKind === 'reddit' && redditSignalId && !storedTitle) {
    const { data: signal } = await supabase
      .from('reddit_signals')
      .select('title')
      .eq('id', redditSignalId)
      .maybeSingle();
    storedTitle = typeof signal?.title === 'string' ? signal.title : null;
  }

  const { data, error } = await supabase.rpc('research_topics_request_brief', {
    p_request_id: input.requestId,
    p_source_kind: input.sourceKind,
    p_cluster_id: clusterId,
    p_reddit_signal_id: redditSignalId,
    p_title: storedTitle,
    p_created_by: input.requestedBy,
    p_force: force,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('research_topic_request_conflict')) {
      return { ok: false, code: RESEARCH_TOPIC_API_ERROR_CODES.requestConflict };
    }
    return { ok: false, code: 'db_error' };
  }

  const row = data as {
    topic_id?: string;
    request_id?: string;
    status?: ResearchTopicStatus;
    publishable?: boolean | null;
    enqueue?: boolean;
    created?: boolean;
  };

  const topicId = String(row.topic_id);
  const requestId = String(row.request_id ?? input.requestId);
  const status = row.status ?? 'queued';
  const publishable = row.publishable ?? null;
  const enqueue = row.enqueue === true;
  const created = row.created === true;

  if (!enqueue) {
    return {
      ok: true,
      topicId,
      requestId,
      status,
      publishable,
      enqueue: false,
      created: false,
    };
  }

  const webhookBody = await buildResearchTopicWebhookBody({
    topicId,
    requestId,
    sourceKind: input.sourceKind,
    clusterId,
    redditSignalId,
    title: storedTitle,
    force,
  });

  if (!webhookBody) {
    await supabase
      .from('research_topics')
      .update({ status: 'failed', error: 'mangler_kontekst' })
      .eq('id', topicId);
    return { ok: false, code: 'not_found', message: 'Fant ikke raden for tema-brief' };
  }

  const webhook = await postResearchTopicWebhook(webhookBody);
  if (!webhook.ok) {
    const failure = mapResearchWebhookFailure(
      webhook.reason === 'not_configured'
        ? { reason: 'not_configured' }
        : webhook.reason === 'timeout'
          ? { reason: 'timeout' }
          : { reason: 'http', status: webhook.status },
    );
    await supabase
      .from('research_topics')
      .update({ status: 'failed', error: failure.briefError })
      .eq('id', topicId);
    return {
      ok: false,
      code: failure.code,
      message: failure.message,
      httpStatus: failure.httpStatus,
    };
  }

  return {
    ok: true,
    topicId,
    requestId,
    status,
    publishable,
    enqueue: true,
    created,
  };
}

export function resolveResearchTopicSourceKey(input: {
  sourceKind: ResearchTopicSourceKind;
  clusterId?: string;
  redditSignalId?: string;
}): string {
  if (input.sourceKind === 'reddit') {
    return `reddit:${input.redditSignalId ?? ''}`;
  }
  return `cluster:${input.clusterId ?? ''}`;
}
