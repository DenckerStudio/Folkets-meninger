import { getServiceSupabase } from '@/lib/supabase';
import { isPollVotingOpen } from '@/lib/polls/format';
import { mapPollRow } from '@/lib/polls/service';
import type { PollRecord } from '@/lib/polls/types';

export type AdminSakPollIndexRow = {
  issueId: string;
  issueTitle: string | null;
  pollId: string | null;
  pollTitle: string | null;
  pollStatusLabel: 'ingen' | 'åpen' | 'stengt' | 'utkast' | 'annet';
};

const POLL_SELECT =
  'id, track, status, title, neutral_summary, stortinget_issue_id, closes_at, opens_at, created_at, updated_at, source_urls, citizen_initiative_id, expired_at, restored_at, generation_metadata';
const DEFAULT_LIMIT = 40;
const SEARCH_LIMIT = 30;

function mapPollStatusLabel(
  poll: Pick<PollRecord, 'status' | 'track' | 'closesAt' | 'opensAt'> | null,
): AdminSakPollIndexRow['pollStatusLabel'] {
  if (!poll) return 'ingen';
  if (poll.track !== 'stortinget') return 'annet';
  if (poll.status === 'draft') return 'utkast';
  if (isPollVotingOpen(poll as PollRecord)) return 'åpen';
  if (poll.status === 'closed' || poll.status === 'open') return 'stengt';
  return 'annet';
}

function sanitizeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '').trim();
}

async function fetchIssueTitles(issueIds: string[]): Promise<Map<string, string | null>> {
  if (issueIds.length === 0) return new Map();
  const service = getServiceSupabase();
  const { data } = await service.from('stortinget_issues').select('id, title').in('id', issueIds);
  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    map.set(String(row.id), typeof row.title === 'string' ? row.title : null);
  }
  return map;
}

async function fetchPollsForIssues(issueIds: string[]) {
  if (issueIds.length === 0) return new Map<string, PollRecord[]>();
  const service = getServiceSupabase();
  const { data } = await service
    .from('polls')
    .select(POLL_SELECT)
    .eq('track', 'stortinget')
    .in('stortinget_issue_id', issueIds)
    .order('created_at', { ascending: false });
  const map = new Map<string, PollRecord[]>();
  for (const raw of data ?? []) {
    const issueId = typeof raw.stortinget_issue_id === 'string' ? raw.stortinget_issue_id.trim() : '';
    if (!issueId) continue;
    const list = map.get(issueId) ?? [];
    list.push(mapPollRow(raw as Parameters<typeof mapPollRow>[0]));
    map.set(issueId, list);
  }
  return map;
}

function buildRows(
  issueIds: string[],
  titles: Map<string, string | null>,
  pollsByIssue: Map<string, PollRecord[]>,
): AdminSakPollIndexRow[] {
  const rows: AdminSakPollIndexRow[] = [];
  for (const issueId of issueIds) {
    const issueTitle = titles.get(issueId) ?? null;
    const polls = pollsByIssue.get(issueId) ?? [];
    if (polls.length === 0) {
      rows.push({
        issueId,
        issueTitle,
        pollId: null,
        pollTitle: null,
        pollStatusLabel: 'ingen',
      });
      continue;
    }
    for (const poll of polls) {
      rows.push({
        issueId,
        issueTitle,
        pollId: poll.id,
        pollTitle: poll.title,
        pollStatusLabel: mapPollStatusLabel(poll),
      });
    }
  }
  rows.sort((a, b) => {
    if (a.pollStatusLabel === 'åpen' && b.pollStatusLabel !== 'åpen') return -1;
    if (b.pollStatusLabel === 'åpen' && a.pollStatusLabel !== 'åpen') return 1;
    return a.issueId.localeCompare(b.issueId, 'nb');
  });
  return rows;
}

export async function listAdminSakPollIndex(query?: string): Promise<AdminSakPollIndexRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const trimmed = query?.trim() ?? '';
  const service = getServiceSupabase();
  const issueIds = new Set<string>();

  if (trimmed) {
    const { data: exactId } = await service
      .from('stortinget_issues')
      .select('id')
      .eq('id', trimmed)
      .maybeSingle();
    if (exactId?.id) issueIds.add(String(exactId.id));

    const like = sanitizeIlike(trimmed);
    if (like) {
      const { data: titleHits } = await service
        .from('stortinget_issues')
        .select('id')
        .ilike('title', `%${like}%`)
        .limit(SEARCH_LIMIT);
      for (const row of titleHits ?? []) issueIds.add(String(row.id));

      const { data: pollHits } = await service
        .from('polls')
        .select('stortinget_issue_id')
        .eq('track', 'stortinget')
        .ilike('title', `%${like}%`)
        .limit(SEARCH_LIMIT);
      for (const row of pollHits ?? []) {
        if (typeof row.stortinget_issue_id === 'string') issueIds.add(row.stortinget_issue_id.trim());
      }
    }
  } else {
    const { data: recentPolls } = await service
      .from('polls')
      .select('stortinget_issue_id')
      .eq('track', 'stortinget')
      .not('stortinget_issue_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(DEFAULT_LIMIT);
    for (const row of recentPolls ?? []) {
      if (typeof row.stortinget_issue_id === 'string') issueIds.add(row.stortinget_issue_id.trim());
    }
  }

  const ids = [...issueIds];
  if (ids.length === 0) return [];

  const [titles, pollsByIssue] = await Promise.all([fetchIssueTitles(ids), fetchPollsForIssues(ids)]);
  const limit = trimmed ? SEARCH_LIMIT : DEFAULT_LIMIT;
  return buildRows(ids, titles, pollsByIssue).slice(0, limit);
}