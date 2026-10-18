import { getServiceSupabase } from '@/lib/supabase';
import type { ActionClusterRecord, ActionClusterStatus, ActionSourceRecord, ActionType } from '@/lib/actions/types';

type ClusterRow = {
  id: string;
  action_key: string;
  action_type: string;
  action_name: string;
  topic: string | null;
  target: string | null;
  description_nb: string;
  sensitive_category: string | null;
  status: string;
  verdict_reasons: unknown;
  independent_publishers: string[] | null;
  national_coverage: boolean;
  max_confidence: number | null;
  best_scale: Record<string, unknown> | null;
  related_issue_id: string | null;
  related_similarity: number | null;
  poll_id: string | null;
  reject_reason: string | null;
  first_seen_at: string;
  last_seen_at: string;
  metadata: Record<string, unknown> | null;
};

type SourceRow = {
  id: string;
  cluster_id: string;
  item_key: string;
  url_canonical: string;
  source_type: string | null;
  publisher: string | null;
  signal_only: boolean;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  fetched_at: string;
  confidence: number | null;
};

const CLUSTER_SELECT =
  'id, action_key, action_type, action_name, topic, target, description_nb, sensitive_category, status, verdict_reasons, independent_publishers, national_coverage, max_confidence, best_scale, related_issue_id, related_similarity, poll_id, reject_reason, first_seen_at, last_seen_at, metadata';

function mapCluster(row: ClusterRow): ActionClusterRecord {
  const reasons = Array.isArray(row.verdict_reasons) ? row.verdict_reasons : [];
  return {
    id: row.id,
    actionKey: row.action_key,
    actionType: row.action_type as ActionType,
    actionName: row.action_name,
    topic: row.topic,
    target: row.target,
    descriptionNb: row.description_nb ?? '',
    sensitiveCategory: row.sensitive_category,
    status: row.status as ActionClusterStatus,
    verdictReasons: reasons,
    independentPublishers: row.independent_publishers ?? [],
    nationalCoverage: Boolean(row.national_coverage),
    maxConfidence: row.max_confidence == null ? null : Number(row.max_confidence),
    bestScale: row.best_scale,
    relatedIssueId: row.related_issue_id,
    relatedSimilarity: row.related_similarity == null ? null : Number(row.related_similarity),
    pollId: row.poll_id,
    rejectReason: row.reject_reason,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    metadata: row.metadata ?? {},
  };
}

function mapSource(row: SourceRow): ActionSourceRecord {
  return {
    id: row.id,
    clusterId: row.cluster_id,
    itemKey: row.item_key,
    urlCanonical: row.url_canonical,
    sourceType: row.source_type,
    publisher: row.publisher,
    signalOnly: Boolean(row.signal_only),
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    confidence: row.confidence == null ? null : Number(row.confidence),
  };
}

export async function listActionClusters(opts?: {
  status?: ActionClusterStatus | 'all';
  limit?: number;
}): Promise<ActionClusterRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  let query = service.from('action_clusters').select(CLUSTER_SELECT).order('last_seen_at', { ascending: false });
  const status = opts?.status ?? 'all';
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  const limit = opts?.limit ?? 100;
  const { data, error } = await query.limit(limit);
  if (error) {
    console.error('[actions] listActionClusters failed', error);
    return [];
  }
  return (data as ClusterRow[]).map(mapCluster);
}

export async function getActionClusterById(id: string): Promise<ActionClusterRecord | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service.from('action_clusters').select(CLUSTER_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapCluster(data as ClusterRow);
}

export async function listActionSourcesForCluster(clusterId: string): Promise<ActionSourceRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('action_sources')
    .select(
      'id, cluster_id, item_key, url_canonical, source_type, publisher, signal_only, title, excerpt, published_at, fetched_at, confidence',
    )
    .eq('cluster_id', clusterId)
    .order('fetched_at', { ascending: false });
  if (error) {
    console.error('[actions] listActionSourcesForCluster failed', error);
    return [];
  }
  return (data as SourceRow[]).map(mapSource);
}

export async function updateActionCluster(
  id: string,
  patch: Partial<{
    status: ActionClusterStatus;
    rejectReason: string | null;
    actionName: string;
    descriptionNb: string;
    metadata: Record<string, unknown>;
    decidedBy: string | null;
  }>,
): Promise<void> {
  const service = getServiceSupabase();
  const row: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.rejectReason !== undefined) row.reject_reason = patch.rejectReason;
  if (patch.actionName) row.action_name = patch.actionName;
  if (patch.descriptionNb !== undefined) row.description_nb = patch.descriptionNb;
  if (patch.metadata) row.metadata = patch.metadata;
  if (patch.decidedBy !== undefined) row.decided_by = patch.decidedBy;
  const { error } = await service.from('action_clusters').update(row).eq('id', id);
  if (error) throw error;
}

export async function mergeActionClusters(
  targetId: string,
  sourceId: string,
  decidedBy: string | null,
): Promise<void> {
  const service = getServiceSupabase();
  const { error: moveError } = await service
    .from('action_sources')
    .update({ cluster_id: targetId })
    .eq('cluster_id', sourceId);
  if (moveError) throw moveError;

  const { error: rejectError } = await service
    .from('action_clusters')
    .update({
      status: 'rejected',
      reject_reason: 'Slått sammen med annen klynge',
      decided_by: decidedBy,
      metadata: { merged_into: targetId },
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', sourceId);
  if (rejectError) throw rejectError;
}

export async function updateActionPollDraft(
  pollId: string,
  patch: { title?: string; neutralSummary?: string },
): Promise<void> {
  const service = getServiceSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title) row.title = patch.title;
  if (patch.neutralSummary !== undefined) row.neutral_summary = patch.neutralSummary;
  const { error } = await service.from('polls').update(row).eq('id', pollId).eq('poll_kind', 'aksjon');
  if (error) throw error;
}

export async function createManualActionPollDraft(
  clusterId: string,
  params: {
    title: string;
    neutralSummary: string;
    sourceUrl: string;
    scaleValue: number | null;
    scaleUnit: string | null;
    scaleSourceUrl: string | null;
    scaleAsOf: string | null;
    approvedByAdmin: string;
  },
): Promise<{ pollId: string | null; reason: string }> {
  const cluster = await getActionClusterById(clusterId);
  if (!cluster) return { pollId: null, reason: 'cluster_not_found' };
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('n8n_create_action_poll_draft', {
    p_action_key: cluster.actionKey,
    p_title: params.title,
    p_neutral_summary: params.neutralSummary,
    p_source_urls: [],
    p_source_url: params.sourceUrl,
    p_scale_value: params.scaleValue,
    p_scale_unit: params.scaleUnit,
    p_scale_source_url: params.scaleSourceUrl,
    p_scale_as_of: params.scaleAsOf,
    p_related_issue_id: cluster.relatedIssueId,
    p_generation_metadata: { approved_by_admin: params.approvedByAdmin },
  });
  if (error) throw error;
  const result = data as { poll_id?: string; created?: boolean; reason?: string };
  return { pollId: result.poll_id ?? null, reason: result.reason ?? 'unknown' };
}
