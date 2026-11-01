import {
  countOppfangetStatuses,
  filterOppfangetRows,
  type OppfangetFilterInput,
} from '@/lib/admin/oppfanget/filters';
import {
  inferIsSignalRow,
  mapActionTypeToDisplayType,
  mapClusterAndPollToDisplayStatus,
} from '@/lib/admin/oppfanget/mapping';
import { listOppfangetMockFiltered } from '@/lib/admin/oppfanget/mock-list';
import {
  isOppfangetEmptyPreviewAllowed,
  isOppfangetMockPreviewAllowed,
} from '@/lib/admin/oppfanget/preview';
import type {
  ActionClusterDbStatus,
  ActionTypeDb,
  OppfangetListResponse,
  OppfangetRow,
  OppfangetScale,
  OppfangetSourceRow,
} from '@/lib/admin/oppfanget/types';
import { normalizeSeenAtRange } from '@/lib/admin/oppfanget/format-seen-dates';
import { sortOppfangetSources } from '@/lib/admin/oppfanget/source-display';
import type { OppfangetSourceType } from '@/lib/admin/oppfanget/types';
import { getServiceSupabase } from '@/lib/supabase';

type ClusterRow = {
  id: string;
  action_name: string;
  action_type: ActionTypeDb;
  status: ActionClusterDbStatus;
  sensitive_category: string | null;
  max_confidence: number | null;
  best_scale: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  poll_id: string | null;
  metadata: Record<string, unknown> | null;
};

type SourceRow = {
  id: string;
  cluster_id: string;
  url_canonical: string;
  publisher: string | null;
  signal_only: boolean;
  title: string | null;
  source_type: string | null;
};

const SOURCE_TYPES: OppfangetSourceType[] = ['news_rss', 'reddit', 'petition', 'searxng'];

function parseSourceType(raw: string | null): OppfangetSourceType | null {
  if (!raw) return null;
  return (SOURCE_TYPES as string[]).includes(raw) ? (raw as OppfangetSourceType) : null;
}

type PollRow = {
  id: string;
  status: string;
};

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  return /action_clusters|does not exist|undefined_table/i.test(error.message ?? '');
}

function parseBestScale(raw: Record<string, unknown> | null): OppfangetScale | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = typeof raw.value === 'number' ? raw.value : null;
  const unit = typeof raw.unit === 'string' ? raw.unit : null;
  const sourceUrl =
    typeof raw.source_url === 'string'
      ? raw.source_url
      : typeof raw.sourceUrl === 'string'
        ? raw.sourceUrl
        : null;
  const asOf =
    typeof raw.as_of === 'string'
      ? raw.as_of
      : typeof raw.asOf === 'string'
        ? raw.asOf
        : null;
  if (value === null && !unit && !sourceUrl) return null;
  return { value, unit, sourceUrl, asOf };
}

export function mapClusterToRow(
  cluster: ClusterRow,
  sources: SourceRow[],
  pollStatus: string | null,
): OppfangetRow {
  const sourceRows: OppfangetSourceRow[] = sortOppfangetSources(
    sources.map((s) => ({
      id: s.id,
      url: s.url_canonical,
      publisher: s.publisher,
      signalOnly: s.signal_only,
      title: s.title,
      sourceType: parseSourceType(s.source_type),
    })),
  );
  const sourcesSignalOnly = sourceRows.length > 0 && sourceRows.every((s) => s.signalOnly);
  const hasNonSignalSource = sourceRows.some((s) => !s.signalOnly);
  const isSignal = inferIsSignalRow({
    clusterStatus: cluster.status,
    metadata: cluster.metadata,
    sourcesSignalOnly,
    hasNonSignalSource,
  });

  const seen = normalizeSeenAtRange(cluster.first_seen_at, cluster.last_seen_at);

  return {
    id: cluster.id,
    title: cluster.action_name,
    actionType: cluster.action_type,
    clusterStatus: cluster.status,
    displayType: mapActionTypeToDisplayType(cluster.action_type, { isSignal }),
    displayStatus: mapClusterAndPollToDisplayStatus(cluster.status, pollStatus),
    sources: sourceRows,
    firstSeenAt: seen.firstSeenAt,
    lastSeenAt: seen.lastSeenAt,
    scale: parseBestScale(cluster.best_scale),
    confidence: cluster.max_confidence,
    sensitive: Boolean(cluster.sensitive_category),
    sensitiveCategory: cluster.sensitive_category,
    pollId: cluster.poll_id,
    pollStatus,
  };
}

export async function listOppfangetForAdmin(
  filters: OppfangetFilterInput,
  previewParam?: string | null,
): Promise<OppfangetListResponse> {
  if (isOppfangetEmptyPreviewAllowed(previewParam)) {
    return {
      rows: [],
      counts: {
        oppfanget: 0,
        under_terskel: 0,
        utkast_laget: 0,
        publisert: 0,
        avvist: 0,
      },
      tableMissing: false,
      tableMissingMessage: null,
      previewMock: false,
    };
  }

  if (isOppfangetMockPreviewAllowed(previewParam)) {
    return listOppfangetMockFiltered(filters);
  }

  const service = getServiceSupabase();

  const { data: clusters, error: clusterError } = await service
    .from('action_clusters')
    .select(
      'id, action_name, action_type, status, sensitive_category, max_confidence, best_scale, first_seen_at, last_seen_at, poll_id, metadata',
    )
    .order('last_seen_at', { ascending: false })
    .limit(500);

  if (clusterError) {
    if (isMissingTableError(clusterError)) {
      return {
        rows: [],
        counts: {
          oppfanget: 0,
          under_terskel: 0,
          utkast_laget: 0,
          publisert: 0,
          avvist: 0,
        },
        tableMissing: true,
        tableMissingMessage:
          'Research-listen er ikke klar i databasen ennå. En administrator må kjøre den ventende databasemigrasjonen før nye signaler kan vises her.',
        previewMock: false,
      };
    }
    throw clusterError;
  }

  const clusterList = (clusters ?? []) as ClusterRow[];
  const clusterIds = clusterList.map((c) => c.id);
  const pollIds = clusterList.map((c) => c.poll_id).filter((id): id is string => Boolean(id));

  let sources: SourceRow[] = [];
  if (clusterIds.length > 0) {
    const { data: sourceData, error: sourceError } = await service
      .from('action_sources')
      .select('id, cluster_id, url_canonical, publisher, signal_only, title, source_type')
      .in('cluster_id', clusterIds);

    if (sourceError && !isMissingTableError(sourceError)) {
      throw sourceError;
    }
    sources = (sourceData ?? []) as SourceRow[];
  }

  const pollStatusById = new Map<string, string>();
  if (pollIds.length > 0) {
    const { data: polls } = await service.from('polls').select('id, status').in('id', pollIds);
    for (const poll of (polls ?? []) as PollRow[]) {
      pollStatusById.set(poll.id, poll.status);
    }
  }

  const sourcesByCluster = new Map<string, SourceRow[]>();
  for (const source of sources) {
    const list = sourcesByCluster.get(source.cluster_id) ?? [];
    list.push(source);
    sourcesByCluster.set(source.cluster_id, list);
  }

  const allRows = clusterList.map((cluster) =>
    mapClusterToRow(
      cluster,
      sourcesByCluster.get(cluster.id) ?? [],
      cluster.poll_id ? pollStatusById.get(cluster.poll_id) ?? null : null,
    ),
  );

  const filterable = allRows.map((row) => ({
    id: row.id,
    title: row.title,
    actionType: row.actionType,
    clusterStatus: row.clusterStatus,
    pollStatus: row.pollStatus,
    metadata: clusterList.find((c) => c.id === row.id)?.metadata ?? null,
    sources: row.sources.map((s) => ({
      publisher: s.publisher,
      signalOnly: s.signalOnly,
      title: s.title,
      sourceType: s.sourceType,
      url: s.url,
    })),
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
  }));

  const counts = countOppfangetStatuses(filterable);
  const filteredIds = new Set(filterOppfangetRows(filterable, filters).map((r) => r.id));
  const rows = allRows.filter((r) => filteredIds.has(r.id));

  return {
    rows,
    counts,
    tableMissing: false,
    tableMissingMessage: null,
    previewMock: false,
  };
}
