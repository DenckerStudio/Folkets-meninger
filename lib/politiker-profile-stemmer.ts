import 'server-only';

import type { SakVotering } from '@/lib/alignment/types';
import {
  aggregatePartyStancesFromVoteringRows,
  fetchPartyStancesForVoteringId,
} from '@/lib/stortinget-votering-rag';
import {
  fetchSakVoteringer,
  isProtocolVotering,
  pickPrimaryVotering,
} from '@/lib/stortinget-voteringer';
import type { PolitikerOversikt } from '@/lib/stortinget';
import type { PolitikerSakItem } from '@/lib/politiker-profile-data';
import { getAnonSupabase } from '@/lib/supabase';
import { findCountyCodeByName, POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import {
  findPublicPollForIssue,
  getPollTotals,
  getPollTotalsByFylke,
  getUserPollVote,
  type PollReadClient,
} from '@/lib/polls/service';
import { pollDistributionRevealAllowed } from '@/lib/polls/poll-distribution-reveal';
import { isPollVotingOpen } from '@/lib/polls/format';
import type { PollTotals } from '@/lib/polls/types';
import {
  pollUserMajority,
  redactPublicPollTotals,
  redactPublicPollTotalsForViewer,
} from '@/lib/public-aggregate/poll-public-output';
import { stortingetUrl, type StortingetFormat } from '@/lib/stortinget-utils';
import {
  buildPolitikerStemmerSummary,
  parseStortingetRepresentantVoteCode,
  representativeAlignsWithPollUsers,
  representativeVotedAgainstParty,
  type PolitikerStemmerBundle,
  type PolitikerStemmerRow,
} from '@/lib/politiker-profile-stemmer-model';

export type {
  PolitikerStemmerBundle,
  PolitikerStemmerRow,
  PolitikerStemmerSummary,
  RepresentantStortingetVote,
} from '@/lib/politiker-profile-stemmer-model';

type VoteringsresultatRow = {
  votering?: number;
  representant?: { id?: string; parti?: { id?: string } };
};

function voteringTimeMs(votering: SakVotering): number {
  const raw = votering.votering_tid ?? '';
  const match = raw.match(/\/Date\((\d+)/);
  if (match?.[1]) return Number.parseInt(match[1], 10);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchVoteringsresultatRows(voteringId: string): Promise<VoteringsresultatRow[]> {
  const res = await fetch(
    stortingetUrl('/eksport/voteringsresultat', {
      voteringid: voteringId,
      format: 'json' satisfies StortingetFormat,
    }),
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { voteringsresultat_liste?: VoteringsresultatRow[] };
  return data.voteringsresultat_liste ?? [];
}

function findRepresentantVoteCode(
  rows: VoteringsresultatRow[],
  personId: string,
): number | null {
  const hit = rows.find((row) => String(row.representant?.id ?? '') === personId);
  if (!hit) return null;
  return typeof hit.votering === 'number' ? hit.votering : null;
}

function partyLineFromRows(rows: VoteringsresultatRow[], partyId: string) {
  const mapped = rows
    .filter((row) => String(row.representant?.parti?.id ?? '') === partyId)
    .map((row) => ({
      partiId: partyId,
      votering: Number(row.votering ?? 0),
    }));
  const stances = aggregatePartyStancesFromVoteringRows(mapped);
  return stances[partyId] ?? null;
}

function formatVoteringDate(votering: SakVotering): { iso: string | null; label: string | null } {
  const ms = voteringTimeMs(votering);
  if (!ms) return { iso: null, label: null };
  const d = new Date(ms);
  return {
    iso: d.toISOString(),
    label: d.toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Oslo',
    }),
  };
}

async function recentStortingetPollIssueIds(limit: number): Promise<Array<{ issueId: string; title: string }>> {
  try {
    const supabase = getAnonSupabase();
    const { data, error } = await supabase
      .from('polls')
      .select('stortinget_issue_id, title')
      .eq('track', 'stortinget')
      .in('status', ['open', 'closed'])
      .not('stortinget_issue_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error || !data?.length) return [];
    return data
      .map((row) => ({
        issueId: String(row.stortinget_issue_id ?? '').trim(),
        title: typeof row.title === 'string' ? row.title : '',
      }))
      .filter((row) => row.issueId.length > 0);
  } catch {
    return [];
  }
}

function collectCandidateIssues(
  saker: PolitikerSakItem[],
  pollIssues: Array<{ issueId: string; title: string }>,
): Array<{ issueId: string; title: string }> {
  const byId = new Map<string, string>();
  for (const sak of saker) {
    byId.set(sak.id, sak.title);
  }
  for (const issue of pollIssues) {
    if (!byId.has(issue.issueId)) {
      byId.set(issue.issueId, issue.title || `Sak ${issue.issueId}`);
    }
  }
  return Array.from(byId.entries()).map(([issueId, title]) => ({ issueId, title }));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      const result = await fn(items[current]);
      if (result) out.push(result);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function buildRowForIssue(args: {
  issueId: string;
  title: string;
  rep: PolitikerOversikt;
  pollClient: PollReadClient | null;
  viewerUserId?: string | null;
}): Promise<PolitikerStemmerRow | null> {
  const voteringer = await fetchSakVoteringer(args.issueId);
  const substantive = voteringer.filter((v) => !isProtocolVotering(v));
  const primary = pickPrimaryVotering(substantive.length > 0 ? substantive : voteringer);
  if (!primary || typeof primary.votering_id !== 'number') return null;

  const voteringId = String(primary.votering_id);
  const rows = await fetchVoteringsresultatRows(voteringId);
  if (rows.length === 0) return null;

  const rawVote = findRepresentantVoteCode(rows, String(args.rep.id));
  if (rawVote == null) return null;

  const representantVote = parseStortingetRepresentantVoteCode(rawVote);
  const partyLine =
    partyLineFromRows(rows, args.rep.parti.id) ??
    (await fetchPartyStancesForVoteringId(voteringId).then((s) => s?.[args.rep.parti.id] ?? null));
  const votedAgainstParty = representativeVotedAgainstParty(representantVote, partyLine);

  const poll = args.pollClient
    ? await findPublicPollForIssue(args.issueId, args.pollClient)
    : null;
  let pollTotalsPublic: PolitikerStemmerRow['pollTotalsPublic'] = null;
  let pollFylkeTotalsPublic: PolitikerStemmerRow['pollFylkeTotalsPublic'] = null;
  let pollFylkeName: string | null = null;
  let comparableWithUsers = false;
  let alignsWithUsers = false;
  let pollOpen = false;
  let pollHref: string | null = null;

  if (poll) {
    pollOpen = isPollVotingOpen(poll);
    pollHref = `/dashboard/avstemninger/${poll.id}`;
    const totals = args.pollClient ? await getPollTotals(poll.id, args.pollClient) : null;
    if (totals) {
      let viewerHasVoted = false;
      if (args.viewerUserId?.trim() && args.pollClient) {
        const voteState = await getUserPollVote(args.viewerUserId, poll.id);
        viewerHasVoted = voteState.hasVoted;
      }
      const revealUserPoll = pollDistributionRevealAllowed(pollOpen, viewerHasVoted, totals);
      pollTotalsPublic = redactPublicPollTotalsForViewer(totals, pollOpen, viewerHasVoted);
      const majority = revealUserPoll ? pollUserMajority(totals) : null;
      if (
        majority &&
        majority !== 'tie' &&
        (representantVote === 'for' || representantVote === 'mot')
      ) {
        comparableWithUsers = true;
        alignsWithUsers = representativeAlignsWithPollUsers(representantVote, majority);
      }

      const fylkeCode = findCountyCodeByName(args.rep.fylke.navn);
      if (revealUserPoll && fylkeCode && args.pollClient) {
        const fylkeRows = await getPollTotalsByFylke(poll.id, POLL_FYLKE_MIN_VOTES, args.pollClient);
        const hit = fylkeRows.find((row) => row.code === fylkeCode && row.sufficientData);
        if (hit) {
          const fylkeTotals: PollTotals = {
            ja: hit.ja ?? 0,
            nei: hit.nei ?? 0,
            blank: hit.blank ?? 0,
            total: hit.total,
          };
          pollFylkeTotalsPublic = redactPublicPollTotals(fylkeTotals);
          pollFylkeName = hit.name;
        }
      }
    }
  }

  const { iso, label } = formatVoteringDate(primary);

  return {
    issueId: args.issueId,
    sakTitle: args.title,
    sakHref: `/dashboard/sak/${args.issueId}`,
    voteringId,
    voteringTema: primary.votering_tema?.trim() || 'Votering',
    votedAtIso: iso,
    votedAtLabel: label,
    representantVote,
    partyLine,
    votedAgainstParty,
    poll,
    pollTotalsPublic,
    pollFylkeTotalsPublic,
    pollFylkeName,
    pollOpen,
    pollHref,
    comparableWithUsers,
    alignsWithUsers,
  };
}

function resolvePollReadClientForPublic(): PollReadClient | null {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    return null;
  }
  try {
    return getAnonSupabase() as unknown as PollReadClient;
  } catch {
    return null;
  }
}

export async function getPolitikerStemmerBundle(
  rep: PolitikerOversikt,
  saker: PolitikerSakItem[],
  options?: { maxIssues?: number; maxRows?: number; viewerUserId?: string | null },
): Promise<PolitikerStemmerBundle> {
  const maxIssues = options?.maxIssues ?? 28;
  const maxRows = options?.maxRows ?? 15;

  try {
    const pollClient = resolvePollReadClientForPublic();
    const pollIssues = await recentStortingetPollIssueIds(40);
    const candidates = collectCandidateIssues(saker, pollIssues).slice(0, maxIssues);

    const rows = await mapWithConcurrency(
      candidates,
      4,
      async (issue) =>
        buildRowForIssue({
          issueId: issue.issueId,
          title: issue.title,
          rep,
          pollClient,
          viewerUserId: options?.viewerUserId ?? null,
        }),
    );

    const sorted = rows
      .slice()
      .sort((a, b) => (b.votedAtIso ?? '').localeCompare(a.votedAtIso ?? ''))
      .slice(0, maxRows);

    if (sorted.length === 0) {
      return {
        status: 'empty',
        summary: buildPolitikerStemmerSummary([]),
        rows: [],
      };
    }

    return {
      status: 'ok',
      summary: buildPolitikerStemmerSummary(sorted),
      rows: sorted,
    };
  } catch (error) {
    console.error('[politiker-stemmer] Kunne ikke laste stemmer:', error);
    return {
      status: 'error',
      summary: buildPolitikerStemmerSummary([]),
      rows: [],
      errorMessage: 'Kunne ikke hente stemmer fra Stortinget akkurat nå. Prøv igjen senere.',
    };
  }
}