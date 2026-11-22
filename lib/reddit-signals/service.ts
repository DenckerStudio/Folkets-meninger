import { getServerSupabase } from '@/lib/supabase-server';
import {
  mapRedditSignalAdminRow,
  mapSnapshotRow,
  type RedditSignalAdminDbRow,
  type RedditSignalSakLink,
  type RedditSignalSnapshotDbRow,
} from '@/lib/reddit-signals/admin-list-map';
import { REDDIT_SIGNALS_LIST_LIMIT } from '@/lib/reddit-signals/admin-map';
import { buildRedditSignalsFixtureList } from '@/lib/reddit-signals/mock-fixture';
import { isRedditSignalsFixturePreviewAllowed } from '@/lib/reddit-signals/preview';
import { filterRedditSignalRows, sortRedditSignalRows } from '@/lib/reddit-signals/sort-filter';
import type { RedditSignalListFilters, RedditSignalListResponse } from '@/lib/reddit-signals/types';

const REDDIT_SIGNAL_LIST_SELECT_BASE =
  'id, reddit_id, subreddit, title, url, score, num_comments, contention, num_crossposts, upvote_ratio, posted_at, snapshot_at, first_seen_at, last_seen_at, topic, related_issue_id, removal_type, flair, ai_relevance, ai_reason, cluster_id, status, status_reason';

const REDDIT_SIGNAL_LIST_SELECT_WITH_REPLY_WORTH = `${REDDIT_SIGNAL_LIST_SELECT_BASE}, reply_worth, reply_worth_reason, reply_worth_status`;

function isMissingRedditTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return /reddit_signals|does not exist|undefined_table/i.test(error.message ?? '');
}

function isMissingReplyWorthColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') {
    return /reply_worth/i.test(error.message ?? '');
  }
  return /column .*reply_worth.* does not exist/i.test(error.message ?? '');
}

async function loadSakLinksBySignalId(
  signalIds: string[],
): Promise<Record<string, RedditSignalSakLink>> {
  const out: Record<string, RedditSignalSakLink> = {};
  if (signalIds.length === 0) return out;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('research_topics')
    .select('id, reddit_signal_id, stortinget_issue_id')
    .in('reddit_signal_id', signalIds);

  if (error || !data) return out;

  for (const row of data) {
    const signalId = row.reddit_signal_id as string | null;
    if (!signalId) continue;
    out[signalId] = {
      researchTopicId: row.id as string,
      stortingetIssueId: (row.stortinget_issue_id as string | null) ?? null,
    };
  }
  return out;
}

async function loadIssueTitles(issueIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(issueIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('stortinget_issues')
    .select('id, title_nb')
    .in('id', unique);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const title = row.title_nb as string | null;
    if (title?.trim()) map[row.id as string] = title.trim();
  }
  return map;
}

async function loadSnapshotsBySignalId(
  signalIds: string[],
): Promise<Record<string, ReturnType<typeof mapSnapshotRow>[]>> {
  if (signalIds.length === 0) return {};
  const supabase = await getServerSupabase();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('reddit_signal_snapshots')
    .select('signal_id, captured_at, score, num_comments, num_crossposts')
    .in('signal_id', signalIds)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });

  if (error || !data) return {};

  const grouped: Record<string, ReturnType<typeof mapSnapshotRow>[]> = {};
  for (const row of data as RedditSignalSnapshotDbRow[]) {
    const id = row.signal_id;
    grouped[id] ??= [];
    grouped[id].push(mapSnapshotRow(row));
  }
  return grouped;
}

export async function listRedditSignalsForAdmin(
  filters: RedditSignalListFilters,
  previewParam?: string | null,
): Promise<RedditSignalListResponse> {
  if (isRedditSignalsFixturePreviewAllowed(previewParam)) {
    const fixture = buildRedditSignalsFixtureList();
    const filtered = filterRedditSignalRows(fixture.rows, filters);
    return {
      rows: sortRedditSignalRows(filtered, filters.sort),
      total: fixture.rows.length,
      filteredTotal: filtered.length,
      previewFixture: true,
      tableMissing: false,
      tableMissingMessage: null,
    };
  }

  const supabase = await getServerSupabase();
  const primary = await supabase
    .from('reddit_signals')
    .select(REDDIT_SIGNAL_LIST_SELECT_WITH_REPLY_WORTH)
    .order('last_seen_at', { ascending: false })
    .limit(REDDIT_SIGNALS_LIST_LIMIT);

  const fallbackNeeded = Boolean(primary.error && isMissingReplyWorthColumnError(primary.error));
  const fallback = fallbackNeeded
    ? await supabase
        .from('reddit_signals')
        .select(REDDIT_SIGNAL_LIST_SELECT_BASE)
        .order('last_seen_at', { ascending: false })
        .limit(REDDIT_SIGNALS_LIST_LIMIT)
    : null;

  const data = (fallback ?? primary).data;
  const error = (fallback ?? primary).error;

  if (error) {
    if (isMissingRedditTableError(error)) {
      return {
        rows: [],
        total: 0,
        filteredTotal: 0,
        previewFixture: false,
        tableMissing: true,
        tableMissingMessage:
          'Signaltabellen er ikke tilgjengelig ennå. En administrator må kjøre den ventende databasemigrasjonen.',
      };
    }
    throw error;
  }

  const dbRows = ((data ?? []) as RedditSignalAdminDbRow[]).map((row) => ({
    ...row,
    reply_worth: row.reply_worth ?? null,
    reply_worth_reason: row.reply_worth_reason ?? null,
    reply_worth_status: row.reply_worth_status ?? null,
  }));
  const signalIds = dbRows.map((r) => r.id);
  const [sakBySignal, snapshotsBySignal, issueTitles] = await Promise.all([
    loadSakLinksBySignalId(signalIds),
    loadSnapshotsBySignalId(signalIds),
    loadIssueTitles(dbRows.map((r) => r.related_issue_id ?? '').filter(Boolean)),
  ]);

  const nowMs = Date.now();
  const rows = dbRows.map((row) => {
    const sak = sakBySignal[row.id] ?? { researchTopicId: null, stortingetIssueId: null };
    const title = row.related_issue_id ? issueTitles[row.related_issue_id] ?? null : null;
    return mapRedditSignalAdminRow(
      row,
      snapshotsBySignal[row.id] ?? [],
      sak,
      title,
      nowMs,
    );
  });

  const filtered = filterRedditSignalRows(rows, filters);
  return {
    rows: sortRedditSignalRows(filtered, filters.sort),
    total: rows.length,
    filteredTotal: filtered.length,
    previewFixture: false,
    tableMissing: false,
    tableMissingMessage: null,
  };
}