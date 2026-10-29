import { countOppfangetStatuses, filterOppfangetRows } from '@/lib/admin/oppfanget/filters';
import { buildOppfangetMockList } from '@/lib/admin/oppfanget/mock-data';
import type { OppfangetFilterInput } from '@/lib/admin/oppfanget/filters';
import type { OppfangetListResponse } from '@/lib/admin/oppfanget/types';

function toFilterableRows(rows: OppfangetListResponse['rows']) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    actionType: row.actionType,
    clusterStatus: row.clusterStatus,
    pollStatus: row.pollStatus,
    metadata: null,
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
}

/** Client-safe mock list (dev preview only — gated by preview.ts on the server). */
export function listOppfangetMockFiltered(filters: OppfangetFilterInput): OppfangetListResponse {
  const mock = buildOppfangetMockList();
  const filterable = toFilterableRows(mock.rows);
  const filteredIds = new Set(filterOppfangetRows(filterable, filters).map((r) => r.id));
  return {
    ...mock,
    rows: mock.rows.filter((r) => filteredIds.has(r.id)),
    counts: countOppfangetStatuses(filterable),
  };
}
