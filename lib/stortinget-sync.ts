import { getServiceSupabase } from './supabase';
import {
  fetchRawSakerFromStortinget,
  mapStortingetSakToListItem,
  enrichSakerList,
} from './stortinget-saker-cache';
import { getCachedSakDetail, refreshStalePendingSakDetails } from './stortinget-detail-cache';
import { isDebattSak } from './stortinget-sak-presentation';
import { resolveSakStatusFromSources } from './sak-status';
import type { StortingetSakDetail } from './stortinget';

export type SyncIssuesResult = {
  upserted: number;
  total: number;
  newIssueIds: string[];
  aiSummaryTriggered: number;
  detailsRefreshed: number;
};

type ExistingIssueRow = {
  id: string;
  first_seen_at: string | null;
  detail_json: StortingetSakDetail | null;
  ferdigbehandlet: boolean | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  category: string | null;
  sak_kind: string | null;
  henvisning: string | null;
  dokumentgruppe: number | null;
  last_updated_at: string | null;
};

type IssueListRow = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  category: string | null;
  sak_kind: string | null;
  henvisning: string | null;
  dokumentgruppe: number | null;
  last_synced_at: string;
  last_updated_at: string;
  ferdigbehandlet: boolean | null;
  first_seen_at: string;
};

function listRowNeedsUpsert(existing: ExistingIssueRow | undefined, next: IssueListRow): boolean {
  if (!existing) return true;
  if (!existing.first_seen_at) return true;

  return (
    existing.title !== next.title ||
    existing.summary !== next.summary ||
    existing.status !== next.status ||
    existing.category !== next.category ||
    existing.sak_kind !== next.sak_kind ||
    existing.henvisning !== next.henvisning ||
    existing.dokumentgruppe !== next.dokumentgruppe ||
    existing.last_updated_at !== next.last_updated_at ||
    existing.ferdigbehandlet !== next.ferdigbehandlet
  );
}

export async function syncStortingetIssuesToDb(): Promise<SyncIssuesResult> {
  const rawSaker = await fetchRawSakerFromStortinget();
  const filtered = rawSaker.filter((sak) =>
    isDebattSak({
      korttittel: sak.korttittel,
      tittel: sak.tittel,
      henvisning: sak.henvisning,
      dokumentgruppe: sak.dokumentgruppe,
    }),
  );

  if (filtered.length === 0) {
    return { upserted: 0, total: 0, newIssueIds: [], aiSummaryTriggered: 0, detailsRefreshed: 0 };
  }

  const issues = await enrichSakerList(filtered.map((sak) => mapStortingetSakToListItem(sak)));
  const service = getServiceSupabase();
  const now = new Date().toISOString();

  const rows = issues.map((issue) => ({
    id: String(issue.id),
    title: issue.title || `Sak ${issue.id}`,
    summary: issue.summary || issue.title || null,
    status: issue.status || 'pending',
    category: issue.category || null,
    sak_kind: issue.sakKind,
    henvisning: issue.henvisning,
    dokumentgruppe: issue.dokumentgruppe,
    last_synced_at: now,
    last_updated_at: issue.date ? `${issue.date}T00:00:00.000Z` : now,
  }));

  const chunkSize = 100;
  let upserted = 0;
  const newIssueIds: string[] = [];
  const missingSummaryIds: string[] = [];

  const issueById = new Map(issues.map((issue) => [String(issue.id), issue]));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkIds = chunk.map((row) => row.id);

    const [{ data: summaries }, { data: existingRows }] = await Promise.all([
      service
        .from('issue_ai_summaries')
        .select('stortinget_issue_id')
        .in('stortinget_issue_id', chunkIds),
      service
        .from('stortinget_issues')
        .select(
          'id, first_seen_at, detail_json, ferdigbehandlet, title, summary, status, category, sak_kind, henvisning, dokumentgruppe, last_updated_at',
        )
        .in('id', chunkIds),
    ]);

    const summarizedIds = new Set((summaries ?? []).map((row) => row.stortinget_issue_id));
    const existingById = new Map(
      ((existingRows ?? []) as ExistingIssueRow[]).map((row) => [row.id, row]),
    );

    const toUpsert: IssueListRow[] = [];

    for (const row of chunk) {
      const existing = existingById.get(row.id);
      const detail = existing?.detail_json ?? null;
      const issue = issueById.get(row.id);
      const status = resolveSakStatusFromSources({
        ferdigbehandlet:
          typeof detail?.ferdigbehandlet === 'boolean'
            ? detail.ferdigbehandlet
            : existing?.ferdigbehandlet,
        detailJson: detail,
        cachedStatus: existing?.status ?? row.status,
        numericStatus: issue?.stortingetNumericStatus,
      });

      const payload: IssueListRow = {
        ...row,
        status,
        ferdigbehandlet:
          typeof detail?.ferdigbehandlet === 'boolean'
            ? detail.ferdigbehandlet
            : (existing?.ferdigbehandlet ?? null),
        first_seen_at: existing?.first_seen_at ?? now,
      };

      if (!listRowNeedsUpsert(existing, payload)) {
        if (!summarizedIds.has(row.id)) {
          missingSummaryIds.push(row.id);
        }
        continue;
      }

      toUpsert.push(payload);
      if (!existing?.first_seen_at) {
        newIssueIds.push(row.id);
      }
      if (!summarizedIds.has(row.id)) {
        missingSummaryIds.push(row.id);
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await service.from('stortinget_issues').upsert(toUpsert, { onConflict: 'id' });
      if (error) {
        console.error('syncStortingetIssuesToDb chunk error:', error);
        throw error;
      }
      upserted += toUpsert.length;
    }
  }

  const candidates = [...new Set([...newIssueIds, ...missingSummaryIds.slice(0, 3)])];
  let aiSummaryTriggered = 0;

  for (const issueId of candidates) {
    await getCachedSakDetail(issueId);
    aiSummaryTriggered += 1;
  }

  const detailsRefreshed = await refreshStalePendingSakDetails(10);

  return { upserted, total: issues.length, newIssueIds, aiSummaryTriggered, detailsRefreshed };
}
