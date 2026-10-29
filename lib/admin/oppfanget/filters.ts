import {
  mapActionTypeToDisplayType,
  mapClusterAndPollToDisplayStatus,
  inferIsSignalRow,
} from '@/lib/admin/oppfanget/mapping';
import type {
  ActionClusterDbStatus,
  ActionTypeDb,
  OppfangetDisplayStatus,
  OppfangetDisplayType,
  OppfangetRow,
  OppfangetStatusCounts,
} from '@/lib/admin/oppfanget/types';

/** Cluster DB status exposed as an explicit admin status filter (hidden by default). */
export const OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION = 'not_action' as const;

export type OppfangetStatusFilter =
  | OppfangetDisplayStatus
  | typeof OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION
  | '';

export type OppfangetFilterInput = {
  type?: OppfangetDisplayType | '';
  status?: OppfangetStatusFilter;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export function hasActiveOppfangetFilters(filters: OppfangetFilterInput): boolean {
  return Boolean(
    filters.type ||
      filters.status ||
      (filters.source ?? '').trim() ||
      filters.dateFrom ||
      filters.dateTo ||
      (filters.q ?? '').trim(),
  );
}

export type OppfangetFilterableRow = {
  id: string;
  title: string;
  actionType: ActionTypeDb;
  clusterStatus: ActionClusterDbStatus;
  pollStatus: string | null;
  metadata: Record<string, unknown> | null;
  sources: {
    publisher: string | null;
    signalOnly: boolean;
    title: string | null;
    sourceType?: string | null;
    url?: string;
  }[];
  firstSeenAt: string;
  lastSeenAt: string;
};

function rowDisplayType(row: OppfangetFilterableRow): OppfangetDisplayType {
  const sourcesSignalOnly = row.sources.length > 0 && row.sources.every((s) => s.signalOnly);
  const hasNonSignalSource = row.sources.some((s) => !s.signalOnly);
  const isSignal = inferIsSignalRow({
    clusterStatus: row.clusterStatus,
    metadata: row.metadata,
    sourcesSignalOnly,
    hasNonSignalSource,
  });
  return mapActionTypeToDisplayType(row.actionType, { isSignal });
}

function rowDisplayStatus(row: OppfangetFilterableRow): OppfangetDisplayStatus {
  return mapClusterAndPollToDisplayStatus(row.clusterStatus, row.pollStatus);
}

function matchesSource(row: OppfangetFilterableRow, source: string): boolean {
  const needle = source.trim().toLowerCase();
  if (!needle) return true;
  return row.sources.some((s) => {
    const pub = (s.publisher ?? '').toLowerCase();
    const title = (s.title ?? '').toLowerCase();
    const url = (s.url ?? '').toLowerCase();
    const type = (s.sourceType ?? '').toLowerCase();
    if (needle === 'reddit') {
      return type === 'reddit' || pub.includes('reddit') || url.includes('reddit.com');
    }
    return pub.includes(needle) || title.includes(needle) || type.includes(needle);
  });
}

function matchesDate(row: OppfangetFilterableRow, dateFrom?: string, dateTo?: string): boolean {
  const seen = new Date(row.lastSeenAt).getTime();
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    if (seen < from) return false;
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (seen > to) return false;
  }
  return true;
}

function matchesSearch(row: OppfangetFilterableRow, q?: string): boolean {
  const needle = (q ?? '').trim().toLowerCase();
  if (!needle) return true;
  if (row.title.toLowerCase().includes(needle)) return true;
  return row.sources.some((s) => (s.title ?? '').toLowerCase().includes(needle));
}

function matchesStatusFilter(row: OppfangetFilterableRow, status: OppfangetStatusFilter | undefined): boolean {
  const filter = status ?? '';
  if (row.clusterStatus === OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION) {
    return filter === OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION;
  }
  if (filter === OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION) {
    return false;
  }
  if (filter && rowDisplayStatus(row) !== filter) {
    return false;
  }
  return true;
}

export function filterOppfangetRows<T extends OppfangetFilterableRow>(
  rows: T[],
  filters: OppfangetFilterInput,
): T[] {
  return rows.filter((row) => {
    if (filters.type && rowDisplayType(row) !== filters.type) return false;
    if (!matchesStatusFilter(row, filters.status)) return false;
    if (!matchesSource(row, filters.source ?? '')) return false;
    if (!matchesDate(row, filters.dateFrom, filters.dateTo)) return false;
    if (!matchesSearch(row, filters.q)) return false;
    return true;
  });
}

export function countOppfangetStatuses(rows: OppfangetFilterableRow[]): OppfangetStatusCounts {
  const counts: OppfangetStatusCounts = {
    oppfanget: 0,
    under_terskel: 0,
    utkast_laget: 0,
    publisert: 0,
    avvist: 0,
  };
  for (const row of rows) {
    if (row.clusterStatus === OPPFANGET_FILTER_CLUSTER_STATUS_NOT_ACTION) {
      continue;
    }
    counts[rowDisplayStatus(row)] += 1;
  }
  return counts;
}

export function toOppfangetRowIdSet(rows: Pick<OppfangetRow, 'id'>[]): Set<string> {
  return new Set(rows.map((r) => r.id));
}
