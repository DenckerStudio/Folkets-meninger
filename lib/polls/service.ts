import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
import { emptyPollTotals } from '@/lib/polls/format';
import { isPollAlreadyExistsError, normalizePollIssueId } from '@/lib/polls/already-exists';
import { nextPollStatusForAction, type PollStatusAction } from '@/lib/polls/apply-status';
import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import type {
  PollChoice,
  PollFylkeTotals,
  PollGenerationMetadata,
  PollRecord,
  PollSourceUrl,
  PollTotals,
  SakPollCandidate,
  SakPollCoverage,
  SystemReelFeedItem,
} from '@/lib/polls/types';

export { emptyPollTotals, isPollVotingOpen, pollChoicePercent } from '@/lib/polls/format';

type PollRow = {
  id: string;
  track: string;
  status: string;
  title: string;
  neutral_summary: string;
  source_urls: unknown;
  stortinget_issue_id: unknown;
  citizen_initiative_id?: string | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  generation_metadata?: unknown;
};

/** Public lists stay lean. Admin draft list includes generation_metadata for stored ratings. */
const POLL_LIST_SELECT =
  'id, track, status, title, neutral_summary, source_urls, stortinget_issue_id, opens_at, closes_at, created_at';

const POLL_ADMIN_DRAFT_SELECT = `${POLL_LIST_SELECT}, generation_metadata`;

const POLL_SELECT = `${POLL_LIST_SELECT}, citizen_initiative_id, generation_metadata`;

function parseSourceUrls(value: unknown): PollSourceUrl[] {
  if (!Array.isArray(value)) return [];
  const out: PollSourceUrl[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url : null;
    if (!url) continue;
    const label = typeof row.label === 'string' ? row.label : undefined;
    out.push({ url, label });
  }
  return out;
}

function parseGenerationMetadata(value: unknown): PollGenerationMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PollGenerationMetadata;
}

export function mapPollRow(row: PollRow): PollRecord {
  return {
    id: row.id,
    track: String(row.track).trim() as PollRecord['track'],
    status: String(row.status).trim() as PollRecord['status'],
    title: row.title,
    neutralSummary: row.neutral_summary ?? '',
    sourceUrls: parseSourceUrls(row.source_urls),
    stortingetIssueId: normalizePollIssueId(row.stortinget_issue_id),
    citizenInitiativeId: row.citizen_initiative_id ?? null,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    createdAt: row.created_at,
    generationMetadata: parseGenerationMetadata(row.generation_metadata),
  };
}

export function parsePollTotals(data: unknown): PollTotals {
  if (!data || typeof data !== 'object') return emptyPollTotals();
  const t = data as Record<string, number>;
  const ja = Number(t.ja ?? 0);
  const nei = Number(t.nei ?? 0);
  const blank = Number(t.blank ?? 0);
  return {
    ja,
    nei,
    blank,
    total: Number(t.total ?? ja + nei + blank),
  };
}

export function parseFylkeTotals(data: unknown): PollFylkeTotals[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      if (typeof r.code !== 'string' || typeof r.name !== 'string') return null;
      return {
        code: r.code,
        name: r.name,
        ja: r.ja == null ? null : Number(r.ja),
        nei: r.nei == null ? null : Number(r.nei),
        blank: r.blank == null ? null : Number(r.blank),
        total: Number(r.total ?? 0),
        sufficientData: Boolean(r.sufficientData),
      } satisfies PollFylkeTotals;
    })
    .filter((x): x is PollFylkeTotals => x != null);
}

async function listPollRows(
  apply: (select: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  label: string,
  select = POLL_LIST_SELECT,
): Promise<PollRow[]> {
  const { data, error } = await apply(select);
  if (error) {
    console.error(`[polls] ${label} failed`, error);
    return [];
  }
  return Array.isArray(data) ? (data as PollRow[]) : [];
}

export async function listOpenPolls(limit = 30): Promise<PollRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const rows = await listPollRows(
    (select) =>
      service
        .from('polls')
        .select(select)
        .neq('track', 'citizen')
        .in('status', ['open', 'closed'])
        .order('created_at', { ascending: false })
        .limit(limit),
    'listOpenPolls',
  );
  return rows.map(mapPollRow);
}

export async function listOpenSystemPolls(limit = 30): Promise<PollRecord[]> {
  const query = (client: ReturnType<typeof getAnonSupabase>) =>
    listPollRows(
      (select) =>
        client
          .from('polls')
          .select(select)
          .eq('track', 'system')
          .in('status', ['open', 'closed'])
          .order('created_at', { ascending: false })
          .limit(limit),
      'listOpenSystemPolls',
    );

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const rows = await query(getServiceSupabase());
      if (rows.length > 0) return rows.map(mapPollRow);
    } catch {
      // Dead or mismatched service-role host — fall through to public read.
    }
  }

  const publicRows = await query(getAnonSupabase());
  return publicRows.map(mapPollRow);
}

export async function listSystemPollDrafts(limit = 50): Promise<PollRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const rows = await listPollRows(
    (select) =>
      service
        .from('polls')
        .select(select)
        .eq('track', 'system')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(limit),
    'listSystemPollDrafts',
    POLL_ADMIN_DRAFT_SELECT,
  );
  return rows.map(mapPollRow);
}

export async function findSystemPollForIssue(issueId: string): Promise<PollRecord | null> {
  const trimmed = normalizePollIssueId(issueId);
  if (!trimmed || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('polls')
    .select(POLL_LIST_SELECT)
    .eq('track', 'system')
    .eq('stortinget_issue_id', trimmed)
    .in('status', ['draft', 'open', 'closed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[polls] findSystemPollForIssue failed', error);
    return null;
  }
  return data ? mapPollRow(data as PollRow) : null;
}

export async function getPollById(pollId: string): Promise<PollRecord | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service.from('polls').select(POLL_SELECT).eq('id', pollId).maybeSingle();

  if (error || !data) return null;
  return mapPollRow(data as PollRow);
}

export async function getPollTotals(pollId: string): Promise<PollTotals> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return emptyPollTotals();
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_poll_totals', { p_poll_id: pollId });
  if (error) return emptyPollTotals();
  return parsePollTotals(data);
}

export async function getPollTotalsByFylke(
  pollId: string,
  minVotes = POLL_FYLKE_MIN_VOTES,
): Promise<PollFylkeTotals[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_poll_totals_by_fylke', {
    p_poll_id: pollId,
    p_min_votes: minVotes,
  });
  if (error) return [];
  return parseFylkeTotals(data);
}

export async function getUserPollVote(
  userId: string,
  pollId: string,
): Promise<{ hasVoted: boolean; vote: PollChoice | null }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { hasVoted: false, vote: null };
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_user_poll_vote', {
    p_user_id: userId,
    p_poll_id: pollId,
  });
  if (error || !data || typeof data !== 'object') return { hasVoted: false, vote: null };
  const row = data as { hasVoted?: boolean; vote?: string };
  const vote = row.vote === 'ja' || row.vote === 'nei' || row.vote === 'blank' ? row.vote : null;
  return { hasVoted: Boolean(row.hasVoted), vote };
}

export async function listSystemReelFeedItems(
  userId: string | null,
  limit = 40,
): Promise<SystemReelFeedItem[]> {
  const polls = await listOpenSystemPolls(limit);
  return Promise.all(
    polls.map(async (poll) => {
      const [totals, voteState] = await Promise.all([
        getPollTotals(poll.id),
        userId
          ? getUserPollVote(userId, poll.id)
          : Promise.resolve({ hasVoted: false, vote: null }),
      ]);
      return { poll, totals, userVote: voteState.vote };
    }),
  );
}

export async function castPollVote(input: {
  userId: string;
  pollId: string;
  choice: PollChoice;
}): Promise<PollTotals> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('cast_poll_vote', {
    p_user_id: input.userId,
    p_poll_id: input.pollId,
    p_choice: input.choice,
  });
  if (error) throw error;
  return parsePollTotals(data);
}

export async function ensureStortingetPoll(input: {
  issueId: string;
  title: string;
  neutralSummary?: string;
  sourceUrls?: PollSourceUrl[];
}): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('ensure_stortinget_poll', {
    p_issue_id: input.issueId,
    p_title: input.title,
    p_neutral_summary: input.neutralSummary ?? '',
    p_source_urls: input.sourceUrls ?? [],
  });
  if (error) {
    console.error('ensure_stortinget_poll failed', error);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

export async function createSystemPollDraft(input: {
  issueId?: string | null;
  title: string;
  neutralSummary?: string;
  sourceUrls?: PollSourceUrl[];
  generationMetadata?: PollGenerationMetadata;
}): Promise<string> {
  const issueId = normalizePollIssueId(input.issueId);
  if (issueId) {
    const existing = await findSystemPollForIssue(issueId);
    if (existing) return existing.id;
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_system_poll_draft', {
    p_issue_id: issueId,
    p_title: input.title,
    p_neutral_summary: input.neutralSummary ?? '',
    p_source_urls: input.sourceUrls ?? [],
    p_generation_metadata: input.generationMetadata ?? {},
  });
  if (error) {
    if (isPollAlreadyExistsError(error) && issueId) {
      const existing = await findSystemPollForIssue(issueId);
      if (existing) return existing.id;
    }
    throw error;
  }
  return String(data);
}

export async function updatePollStatusRow(pollId: string, action: PollStatusAction): Promise<string> {
  const service = getServiceSupabase();
  const { data: row, error: readError } = await service
    .from('polls')
    .select('id, status, opens_at')
    .eq('id', pollId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw new Error('Poll not found');

  const next = nextPollStatusForAction(String(row.status), action);
  const patch: { status: 'open' | 'archived'; updated_at: string; opens_at?: string } = {
    status: next.status,
    updated_at: new Date().toISOString(),
  };
  if (next.setOpensAtIfMissing && !row.opens_at) {
    patch.opens_at = patch.updated_at;
  }

  const { error: updateError } = await service.from('polls').update(patch).eq('id', pollId);
  if (updateError) throw updateError;
  return pollId;
}

export async function publishPoll(pollId: string): Promise<string> {
  // Live PATCH /api/admin/polls failed with PGRST202: PostgREST has no
  // publish_poll(p_poll_id) / archive_poll(p_poll_id) in its schema cache.
  // Update the row with the service role instead of calling those RPCs.
  return updatePollStatusRow(pollId, 'publish');
}

export async function archivePoll(pollId: string): Promise<string> {
  return updatePollStatusRow(pollId, 'archive');
}

export async function getSakPollCoverage(): Promise<SakPollCoverage> {
  const empty: SakPollCoverage = {
    pendingIssues: 0,
    pendingWithRag: 0,
    pendingWithPoll: 0,
    sakCandidates: 0,
  };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty;
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_sak_poll_coverage');
  if (error || !data) return empty;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return empty;
  const r = row as Record<string, unknown>;
  return {
    pendingIssues: Number(r.pending_issues ?? 0),
    pendingWithRag: Number(r.pending_with_rag ?? 0),
    pendingWithPoll: Number(r.pending_with_poll ?? 0),
    sakCandidates: Number(r.sak_candidates ?? 0),
  };
}

export async function listSakPollCandidates(limit = 25): Promise<SakPollCandidate[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_sak_poll_candidates', { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      if (typeof r.issue_id !== 'string') return null;
      const sourceKindRaw = typeof r.source_kind === 'string' ? r.source_kind : 'metadata';
      const sourceKind =
        sourceKindRaw === 'rag' || sourceKindRaw === 'ai_summary' || sourceKindRaw === 'metadata'
          ? sourceKindRaw
          : 'metadata';
      return {
        issueId: r.issue_id,
        title: typeof r.title === 'string' ? r.title : r.issue_id,
        summary: typeof r.summary === 'string' ? r.summary : '',
        lastUpdatedAt: typeof r.last_updated_at === 'string' ? r.last_updated_at : null,
        ragChunkCount: Number(r.rag_chunk_count ?? 0),
        hasAiSummary: Boolean(r.has_ai_summary),
        sourceKind,
      } satisfies SakPollCandidate;
    })
    .filter((x): x is SakPollCandidate => x != null);
}

