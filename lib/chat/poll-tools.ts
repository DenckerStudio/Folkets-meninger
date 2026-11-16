import { tool } from 'ai';
import { z } from 'zod';
import type { ChatRagClient } from '@/lib/chat/rag';
import {
  emptyPollTotals,
  findPublicPollForIssue,
  getPollTotals,
  getPollTotalsByFylke,
  getPublicPollById,
  getUserPollVote,
  searchPublicPolls,
  type PollReadClient,
} from '@/lib/polls/service';
import { isPollVotingOpen, pollChoicePercent } from '@/lib/polls/format';
import { pollBallotAltTextPhrase } from '@/lib/polls/ballot-buttons';
import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import {
  POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE,
  POLL_FYLKE_HIDDEN_UNTIL_VOTE_MESSAGE,
  pollDistributionRevealAllowed,
  preparePollFylkeForViewer,
  redactPollTotalsForViewer,
} from '@/lib/polls/poll-distribution-reveal';
import type { PollFylkeTotals, PollRecord, PollTotals } from '@/lib/polls/types';
import type { CitationRegistry } from '@/lib/chat/citations';

export type ChatPollPercents = { ja: number; nei: number; blank: number };

export type ChatPollResults = {
  found: boolean;
  pollId: string | null;
  title: string | null;
  summary: string | null;
  status: PollRecord['status'] | null;
  track: PollRecord['track'] | null;
  stortingetIssueId: string | null;
  isOpen: boolean;
  closesAt: string | null;
  totals: PollTotals;
  percents: ChatPollPercents;
  byFylke: PollFylkeTotals[];
  fylkeMinVotes: number;
  distributionVisible: boolean;
  fylkeHiddenUntilVote: boolean;
  note: string | null;
};

/**
 * The chat passes the authenticated session client, which is `Pick<SupabaseClient,'from'>`
 * at the type level but carries `rpc` at runtime. `PollReadClient` needs both; the
 * service layer falls back to the anon client when nothing is provided.
 */
function asPollClient(client?: ChatRagClient | null): PollReadClient | null {
  return (client as unknown as PollReadClient | null | undefined) ?? null;
}

function chatPollResultsNote(args: {
  votingOpen: boolean;
  hasVoted: boolean;
  rawTotals: PollTotals;
  fylkeHiddenUntilVote: boolean;
}): string | null {
  if (args.rawTotals.total === 0) {
    return 'Ingen har stemt i denne avstemningen ennå.';
  }
  if (args.votingOpen && !args.hasVoted) {
    return 'Stem for å se fordelingen.';
  }
  if (!pollDistributionRevealAllowed(args.votingOpen, args.hasVoted, args.rawTotals)) {
    return POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE;
  }
  if (args.fylkeHiddenUntilVote) {
    return POLL_FYLKE_HIDDEN_UNTIL_VOTE_MESSAGE;
  }
  return null;
}

export function shapeChatPollResults(args: {
  poll: PollRecord | null;
  totals?: PollTotals;
  rawTotals?: PollTotals;
  byFylke?: PollFylkeTotals[];
  fylkeHiddenUntilVote?: boolean;
  votingOpen?: boolean;
  hasVoted?: boolean;
}): ChatPollResults {
  const totals = args.totals ?? emptyPollTotals();
  const poll = args.poll;

  if (!poll) {
    return {
      found: false,
      pollId: null,
      title: null,
      summary: null,
      status: null,
      track: null,
      stortingetIssueId: null,
      isOpen: false,
      closesAt: null,
      totals,
      percents: { ja: 0, nei: 0, blank: 0 },
      byFylke: args.byFylke ?? [],
      fylkeMinVotes: POLL_FYLKE_MIN_VOTES,
      distributionVisible: false,
      fylkeHiddenUntilVote: false,
      note: 'Fant ingen åpen eller avsluttet avstemning som passer. Oppgi et poll-id, en sak eller en tydeligere tittel.',
    };
  }

  const votingOpen = args.votingOpen ?? isPollVotingOpen(poll);
  const hasVoted = args.hasVoted ?? false;
  const rawTotals = args.rawTotals ?? totals;
  const reveal = pollDistributionRevealAllowed(votingOpen, hasVoted, rawTotals);
  const fylkeHiddenUntilVote = args.fylkeHiddenUntilVote ?? false;

  return {
    found: true,
    pollId: poll.id,
    title: poll.title,
    summary: poll.neutralSummary,
    status: poll.status,
    track: poll.track,
    stortingetIssueId: poll.stortingetIssueId,
    isOpen: votingOpen,
    closesAt: poll.closesAt,
    totals,
    percents: reveal
      ? {
          ja: pollChoicePercent(rawTotals, 'ja') ?? 0,
          nei: pollChoicePercent(rawTotals, 'nei') ?? 0,
          blank: pollChoicePercent(rawTotals, 'blank') ?? 0,
        }
      : { ja: 0, nei: 0, blank: 0 },
    byFylke: args.byFylke ?? [],
    fylkeMinVotes: POLL_FYLKE_MIN_VOTES,
    distributionVisible: reveal,
    fylkeHiddenUntilVote,
    note: chatPollResultsNote({ votingOpen, hasVoted, rawTotals, fylkeHiddenUntilVote }),
  };
}

export async function collectPollResults(args: {
  pollId?: string;
  issueId?: string;
  query?: string;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
  client?: ChatRagClient | null;
  viewerUserId?: string | null;
}): Promise<ChatPollResults> {
  const client = asPollClient(args.client);
  const pollId = args.pollId?.trim();
  let poll: PollRecord | null = null;

  if (pollId) {
    poll = await getPublicPollById(pollId, client);
  }

  if (!poll) {
    const directIssue = args.issueId?.trim() || null;
    const resolvedIssue =
      directIssue ?? (args.query ? await args.resolveIssueId({ query: args.query }) : null);
    if (resolvedIssue) {
      poll = await findPublicPollForIssue(resolvedIssue, client);
    }
  }

  if (!poll && args.query?.trim()) {
    const matches = await searchPublicPolls(args.query.trim(), 1, client);
    poll = matches[0] ?? null;
  }

  if (!poll) return shapeChatPollResults({ poll: null });

  const votingOpen = isPollVotingOpen(poll);
  let hasVoted = false;
  if (args.viewerUserId?.trim()) {
    const voteState = await getUserPollVote(args.viewerUserId, poll.id);
    hasVoted = voteState.hasVoted;
  }

  const [totals, byFylke] = await Promise.all([
    getPollTotals(poll.id, client),
    getPollTotalsByFylke(poll.id, POLL_FYLKE_MIN_VOTES, client),
  ]);

  const viewerTotals = redactPollTotalsForViewer(totals, votingOpen, hasVoted);
  const fylkePayload = preparePollFylkeForViewer(byFylke, votingOpen, hasVoted);

  return shapeChatPollResults({
    poll,
    totals: viewerTotals,
    rawTotals: totals,
    byFylke: fylkePayload.byFylke,
    fylkeHiddenUntilVote: fylkePayload.hiddenUntilVote,
    votingOpen,
    hasVoted,
  });
}

export function createPollChatTools(args: {
  client?: ChatRagClient | null;
  /** Per-request source registry so poll results can be cited as [n]. */
  citations?: CitationRegistry | null;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
  viewerUserId?: string | null;
}) {
  return {
    getPollResults: tool({
      description:
        `Hent resultatet av en ${pollBallotAltTextPhrase()}-avstemning i appen: antall og prosent per valg, om den er åpen, og fylkesfordeling når den er over personvern-terskelen. Bruk når brukeren spør hva folk stemte i en avstemning eller hvordan en sak står i avstemningen.`,
      inputSchema: z.object({
        pollId: z.string().optional().describe('Avstemnings-id hvis kjent.'),
        issueId: z
          .string()
          .optional()
          .describe('Stortinget sak-id hvis kjent. La stå tom for å søke på tittel.'),
        query: z
          .string()
          .min(2)
          .optional()
          .describe('Tittel eller spørsmål hvis poll-id eller sak-id ikke er kjent.'),
      }),
      execute: async ({ pollId, issueId, query }) => {
        const result = await collectPollResults({
          pollId,
          issueId,
          query,
          resolveIssueId: args.resolveIssueId,
          client: args.client,
          viewerUserId: args.viewerUserId,
        });
        if (!result.found || !result.pollId || !args.citations) return result;
        const source = args.citations.cite({
          kind: 'avstemning',
          title: result.title || 'Avstemning i appen',
          pollId: result.pollId,
          issueId: result.stortingetIssueId,
        });
        return { ...result, kilde: source.n, kilder: [source] };
      },
    }),
  };
}