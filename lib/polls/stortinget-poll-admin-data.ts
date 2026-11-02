import { getServiceSupabase } from '@/lib/supabase';
import type { IssuePollAdminRow, StortingetIssueTextSnapshot } from '@/lib/polls/stortinget-poll-admin-guard';
import { issueTextSnapshotEquals } from '@/lib/polls/stortinget-poll-admin-guard';

const ISSUE_POLL_ADMIN_SELECT =
  'id, track, status, title, neutral_summary, closes_at, stortinget_issue_id, source_urls, opens_at, created_at, updated_at, expired_at, restored_at';

export async function listPollsForStortingetIssueAdmin(issueId: string): Promise<IssuePollAdminRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const trimmed = issueId.trim();
  if (!trimmed) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('polls')
    .select(ISSUE_POLL_ADMIN_SELECT)
    .eq('stortinget_issue_id', trimmed)
    .order('created_at', { ascending: false });
  if (error || !Array.isArray(data)) {
    console.error('[polls] listPollsForStortingetIssueAdmin failed', error);
    return [];
  }
  return data.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id ?? ''),
      track: String(record.track ?? ''),
      status: String(record.status ?? ''),
      title: String(record.title ?? ''),
      neutralSummary: String(record.neutral_summary ?? ''),
      closesAt: typeof record.closes_at === 'string' ? record.closes_at : null,
    };
  });
}

export async function readStortingetIssueTextSnapshot(
  issueId: string,
): Promise<StortingetIssueTextSnapshot | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const trimmed = issueId.trim();
  if (!trimmed) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('stortinget_issues')
    .select('title, summary')
    .eq('id', trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return {
    title: typeof data.title === 'string' ? data.title : null,
    summary: typeof data.summary === 'string' ? data.summary : null,
  };
}

export async function restoreStortingetIssueTextSnapshot(
  issueId: string,
  expected: StortingetIssueTextSnapshot,
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('missing service role');
  }
  const trimmed = issueId.trim();
  if (!trimmed) return;
  const current = await readStortingetIssueTextSnapshot(trimmed);
  if (issueTextSnapshotEquals(current, expected)) return;
  const service = getServiceSupabase();
  const { error } = await service
    .from('stortinget_issues')
    .update({ title: expected.title, summary: expected.summary })
    .eq('id', trimmed);
  if (error) throw error;
}
