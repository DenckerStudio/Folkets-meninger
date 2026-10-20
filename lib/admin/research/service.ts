import { getServiceSupabase } from '@/lib/supabase';
import type {
  ResearchBriefKind,
  ResearchBriefRow,
  ResearchWebhookBody,
} from '@/lib/admin/research/types';
import { postResearchWebhook } from '@/lib/admin/research/webhook';
import {
  researchApiActionToKind,
  type ResearchApiAction,
} from '@/lib/admin/research/actions';
import { RESEARCH_API_ERROR_CODES } from '@/lib/admin/research/api-error-codes';

function parseResearchBriefsEnqueueError(error: {
  message?: string;
  details?: string;
}): {
  code: 'research_request_conflict' | 'research_brief_active' | 'db_error';
  requestId?: string;
} {
  const message = error.message ?? '';
  if (message.includes('research_request_conflict')) {
    return { code: RESEARCH_API_ERROR_CODES.requestConflict };
  }
  if (message.includes('research_brief_active')) {
    const detail = error.details?.trim();
    const uuidMatch = detail?.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    return {
      code: RESEARCH_API_ERROR_CODES.briefActive,
      requestId: uuidMatch?.[0],
    };
  }
  return { code: 'db_error' };
}

function parseBriefRow(raw: Record<string, unknown>): ResearchBriefRow {
  return {
    id: String(raw.id),
    request_id: String(raw.request_id),
    cluster_id: String(raw.cluster_id),
    kind: raw.kind as ResearchBriefKind,
    status: raw.status as ResearchBriefRow['status'],
    summary: typeof raw.summary === 'string' ? raw.summary : null,
    perspectives: Array.isArray(raw.perspectives) ? (raw.perspectives as ResearchBriefRow['perspectives']) : [],
    sources: Array.isArray(raw.sources) ? (raw.sources as ResearchBriefRow['sources']) : [],
    details:
      raw.details && typeof raw.details === 'object' && !Array.isArray(raw.details)
        ? (raw.details as ResearchBriefRow['details'])
        : {},
    output_ref: typeof raw.output_ref === 'string' ? raw.output_ref : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    requested_by: typeof raw.requested_by === 'string' ? raw.requested_by : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

const RESEARCH_BRIEF_STALE_MINUTES = 30;

export async function expireStaleResearchBriefs(
  minutes: number = RESEARCH_BRIEF_STALE_MINUTES,
): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase.rpc('research_briefs_expire_stale', { p_minutes: minutes });
}

export async function getLatestDoneDeepenRequestIdForCluster(
  clusterId: string,
): Promise<string | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_briefs')
    .select('request_id')
    .eq('cluster_id', clusterId)
    .eq('kind', 'deepen')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String(data.request_id);
}

export async function getLatestResearchBriefForCluster(
  clusterId: string,
): Promise<ResearchBriefRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_briefs')
    .select('*')
    .eq('cluster_id', clusterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return parseBriefRow(data as Record<string, unknown>);
}

export async function listResearchBriefsForCluster(clusterId: string): Promise<ResearchBriefRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_briefs')
    .select('*')
    .eq('cluster_id', clusterId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => parseBriefRow(row as Record<string, unknown>));
}

export async function buildResearchWebhookBody(
  clusterId: string,
  requestId: string,
  kind: ResearchBriefKind,
  requestedBy: string,
): Promise<ResearchWebhookBody | null> {
  const supabase = getServiceSupabase();
  const { data: cluster, error: clusterError } = await supabase
    .from('action_clusters')
    .select('id, action_key, action_name, description_nb, status')
    .eq('id', clusterId)
    .maybeSingle();
  if (clusterError || !cluster) return null;

  const { data: sources } = await supabase
    .from('action_sources')
    .select('url_canonical, publisher, title, published_at, source_type')
    .eq('cluster_id', clusterId);

  const latest = await getLatestResearchBriefForCluster(clusterId);

  const body: ResearchWebhookBody = {
    request_id: requestId,
    kind,
    cluster_id: clusterId,
    action_key: cluster.action_key,
    requested_by: requestedBy,
    requested_at: new Date().toISOString(),
    cluster: {
      title: cluster.action_name,
      summary: cluster.description_nb,
      status: cluster.status,
      sources: (sources ?? []).map((s) => ({
        url: s.url_canonical,
        publisher: s.publisher,
        title: s.title,
        published_at: s.published_at,
        source_type: s.source_type,
      })),
    },
  };

  if (kind === 'blog' || kind === 'reel') {
    body.source_request_id = await getLatestDoneDeepenRequestIdForCluster(clusterId);
    if (latest) {
      body.latest_brief = {
        summary: latest.summary,
        perspectives: latest.perspectives,
        sources: latest.sources,
      };
    }
  }

  return body;
}

export type ResearchBriefSnapshot = Pick<
  ResearchBriefRow,
  'kind' | 'status' | 'output_ref' | 'request_id'
>;

export type ResearchBriefsByKind = Partial<
  Record<ResearchApiAction, ResearchBriefSnapshot>
>;

export async function getLatestResearchBriefsByClusterIds(
  clusterIds: string[],
): Promise<Record<string, Partial<Record<ResearchBriefKind, ResearchBriefSnapshot>>>> {
  if (clusterIds.length === 0) return {};
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_briefs')
    .select('cluster_id, kind, status, output_ref, request_id, created_at')
    .in('cluster_id', clusterIds)
    .order('created_at', { ascending: false });
  if (error || !data) return {};

  const out: Record<string, Partial<Record<ResearchBriefKind, ResearchBriefSnapshot>>> = {};
  for (const row of data) {
    const clusterId = String(row.cluster_id);
    const kind = row.kind as ResearchBriefKind;
    const bucket = out[clusterId] ?? {};
    if (bucket[kind]) continue;
    bucket[kind] = {
      kind,
      status: row.status as ResearchBriefRow['status'],
      output_ref: typeof row.output_ref === 'string' ? row.output_ref : null,
      request_id: String(row.request_id),
    };
    out[clusterId] = bucket;
  }
  return out;
}

async function findActiveResearchBrief(
  clusterId: string,
  kind: ResearchBriefKind,
  excludeRequestId?: string,
): Promise<ResearchBriefSnapshot | null> {
  const supabase = getServiceSupabase();
  let query = supabase
    .from('research_briefs')
    .select('kind, status, output_ref, request_id')
    .eq('cluster_id', clusterId)
    .eq('kind', kind)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (excludeRequestId) {
    query = query.neq('request_id', excludeRequestId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return {
    kind: data.kind as ResearchBriefKind,
    status: data.status as ResearchBriefRow['status'],
    output_ref: typeof data.output_ref === 'string' ? data.output_ref : null,
    request_id: String(data.request_id),
  };
}

export async function enqueueResearchJob(
  clusterId: string,
  action: ResearchApiAction,
  requestedBy: string,
  requestId: string,
): Promise<
  | { ok: true; requestId: string; status: ResearchBriefRow['status']; created: boolean }
  | {
      ok: false;
      code:
        | 'not_found'
        | 'webhook_failed'
        | 'not_configured'
        | 'db_error'
        | 'research_brief_active'
        | 'research_request_conflict'
        | 'invalid_request_id';
      requestId?: string;
      status?: ResearchBriefRow['status'];
    }
> {
  const kind = researchApiActionToKind(action);
  const supabase = getServiceSupabase();

  await expireStaleResearchBriefs();

  const webhookBody = await buildResearchWebhookBody(clusterId, requestId, kind, requestedBy);
  if (!webhookBody) {
    return { ok: false, code: 'not_found' };
  }

  const { data: enqueued, error: enqueueError } = await supabase.rpc('research_briefs_enqueue', {
    p_request_id: requestId,
    p_cluster_id: clusterId,
    p_kind: kind,
    p_requested_by: requestedBy,
  });

  if (enqueueError) {
    const parsed = parseResearchBriefsEnqueueError(enqueueError);
    if (parsed.code === RESEARCH_API_ERROR_CODES.requestConflict) {
      return { ok: false, code: RESEARCH_API_ERROR_CODES.requestConflict };
    }
    if (parsed.code === RESEARCH_API_ERROR_CODES.briefActive) {
      let activeRequestId = parsed.requestId;
      let activeStatus: ResearchBriefRow['status'] | undefined;
      if (!activeRequestId) {
        const active = await findActiveResearchBrief(clusterId, kind, requestId);
        activeRequestId = active?.request_id;
        activeStatus = active?.status;
      }
      return {
        ok: false,
        code: RESEARCH_API_ERROR_CODES.briefActive,
        requestId: activeRequestId,
        status: activeStatus,
      };
    }
    return { ok: false, code: 'db_error' };
  }

  const enqueuedRow = enqueued as {
    request_id?: string;
    status?: ResearchBriefRow['status'];
    created?: boolean;
  } | null;
  const resolvedRequestId = String(enqueuedRow?.request_id ?? requestId);
  const resolvedStatus = enqueuedRow?.status ?? 'queued';
  const created = enqueuedRow?.created === true;

  if (!created) {
    return {
      ok: true,
      requestId: resolvedRequestId,
      status: resolvedStatus,
      created: false,
    };
  }

  const webhook = await postResearchWebhook(action, webhookBody);
  if (!webhook.ok) {
    const briefError =
      webhook.reason === 'not_configured'
        ? 'arbeidsflyt_utilgjengelig'
        : `webhook_http_${webhook.status ?? 502}`;
    await supabase
      .from('research_briefs')
      .update({ status: 'failed', error: briefError })
      .eq('request_id', requestId);
    return {
      ok: false,
      code: webhook.reason === 'not_configured' ? 'not_configured' : 'webhook_failed',
    };
  }

  return {
    ok: true,
    requestId: resolvedRequestId,
    status: resolvedStatus,
    created: true,
  };
}

export async function markResearchBriefFailed(requestId: string, message: string): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase
    .from('research_briefs')
    .update({ status: 'failed', error: message })
    .eq('request_id', requestId);
}
