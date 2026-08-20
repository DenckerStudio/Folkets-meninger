import { getServiceSupabase } from '@/lib/supabase';
import { emptyPollTotals } from '@/lib/polls/format';
import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import type {
  CitizenInitiativeRecord,
  PollChoice,
  PollFylkeTotals,
  PollRecord,
  PollSourceUrl,
  PollTotals,
} from '@/lib/polls/types';

export { emptyPollTotals, isPollVotingOpen, pollChoicePercent } from '@/lib/polls/format';

type PollRow = {
  id: string;
  track: string;
  status: string;
  title: string;
  neutral_summary: string;
  source_urls: unknown;
  stortinget_issue_id: string | null;
  citizen_initiative_id: string | null;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
};

type InitiativeRow = {
  id: string;
  title: string;
  body: string;
  author_user_id: string;
  support_threshold: number;
  support_count: number;
  status: string;
  promoted_poll_id: string | null;
  created_at: string;
};

const POLL_SELECT =
  'id, track, status, title, neutral_summary, source_urls, stortinget_issue_id, citizen_initiative_id, opens_at, closes_at, created_at';

const INITIATIVE_SELECT =
  'id, title, body, author_user_id, support_threshold, support_count, status, promoted_poll_id, created_at';

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

export function mapPollRow(row: PollRow): PollRecord {
  return {
    id: row.id,
    track: row.track as PollRecord['track'],
    status: row.status as PollRecord['status'],
    title: row.title,
    neutralSummary: row.neutral_summary ?? '',
    sourceUrls: parseSourceUrls(row.source_urls),
    stortingetIssueId: row.stortinget_issue_id,
    citizenInitiativeId: row.citizen_initiative_id,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    createdAt: row.created_at,
  };
}

export function mapInitiativeRow(row: InitiativeRow): CitizenInitiativeRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorUserId: row.author_user_id,
    supportThreshold: row.support_threshold,
    supportCount: row.support_count,
    status: row.status as CitizenInitiativeRecord['status'],
    promotedPollId: row.promoted_poll_id,
    createdAt: row.created_at,
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

export async function listOpenPolls(limit = 30): Promise<PollRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('polls')
    .select(POLL_SELECT)
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as PollRow[]).map(mapPollRow);
}

export async function getPollById(pollId: string): Promise<PollRecord | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service.from('polls').select(POLL_SELECT).eq('id', pollId).maybeSingle();

  if (error || !data) return null;
  return mapPollRow(data as PollRow);
}

export async function getPollByStortingetIssueId(issueId: string): Promise<PollRecord | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !issueId) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('polls')
    .select(POLL_SELECT)
    .eq('stortinget_issue_id', issueId)
    .in('status', ['open', 'closed'])
    .maybeSingle();

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

export async function listCitizenInitiatives(limit = 30): Promise<CitizenInitiativeRecord[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('citizen_initiatives')
    .select(INITIATIVE_SELECT)
    .in('status', ['gathering', 'threshold_met', 'promoted'])
    .order('support_count', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as InitiativeRow[]).map(mapInitiativeRow);
}

export async function getCitizenInitiative(id: string): Promise<CitizenInitiativeRecord | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('citizen_initiatives')
    .select(INITIATIVE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapInitiativeRow(data as InitiativeRow);
}

export async function createCitizenInitiative(input: {
  userId: string;
  title: string;
  body: string;
  supportThreshold?: number;
}): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_citizen_initiative', {
    p_user_id: input.userId,
    p_title: input.title,
    p_body: input.body,
    p_support_threshold: input.supportThreshold ?? 500,
  });
  if (error) throw error;
  return String(data);
}

export async function endorseCitizenInitiative(userId: string, initiativeId: string) {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('endorse_citizen_initiative', {
    p_user_id: userId,
    p_initiative_id: initiativeId,
  });
  if (error) throw error;
  return data as {
    initiativeId: string;
    supportCount: number;
    supportThreshold: number;
    status: string;
    endorsed: boolean;
  };
}

export async function promoteCitizenInitiativeToPoll(input: {
  initiativeId: string;
  actorUserId?: string | null;
  force?: boolean;
}): Promise<string> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('promote_citizen_initiative_to_poll', {
    p_initiative_id: input.initiativeId,
    p_actor_user_id: input.actorUserId ?? null,
    p_force: input.force ?? false,
  });
  if (error) throw error;
  return String(data);
}

export async function userHasEndorsedInitiative(userId: string, initiativeId: string): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const service = getServiceSupabase();
  const { data } = await service
    .from('citizen_initiative_endorsements')
    .select('initiative_id')
    .eq('initiative_id', initiativeId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}
