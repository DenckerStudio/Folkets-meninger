import { tool } from 'ai';
import { z } from 'zod';
import type { ChatRagClient } from '@/lib/chat/rag';
import {
  emptyPollTotals,
  findPublicPollForIssue,
  getPollTotals,
  getPollTotalsByFylke,
  getPublicPollById,
  searchPublicPolls,
  type PollReadClient,
} from '@/lib/polls/service';
import { isPollVotingOpen, POLL_PUBLIC_PERCENT_MIN_VOTES, pollChoicePercent } from '@/lib/polls/format';
import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
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

export function shapeChatPollResults(args: {
  poll: PollRecord | null;
  totals?: PollTotals;
  byFylke?: PollFylkeTotals[];
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
      note: 'Fant ingen åpen eller avsluttet avstemning som passer. Oppgi et poll-id, en sak eller en tydeligere tittel.',
    };
  }

  return {
    found: true,
    pollId: poll.id,
    title: poll.title,
    summary: poll.neutralSummary,
    status: poll.status,
    track: poll.track,
    stortingetIssueId: poll.stortingetIssueId,
    isOpen: isPollVotingOpen(poll),
    closesAt: poll.closesAt,
    totals,
    percents: {
      ja: pollChoicePercent(totals, 'ja') ?? 0,
      nei: pollChoicePercent(totals, 'nei') ?? 0,
      blank: pollChoicePercent(totals, 'blank') ?? 0,
    },
    byFylke: args.byFylke ?? [],
    fylkeMinVotes: POLL_FYLKE_MIN_VOTES,
    note:
      totals.total === 0
        ? 'Ingen har stemt i denne avstemningen ennå.'
        : totals.total < POLL_PUBLIC_PERCENT_MIN_VOTES
          ? `Færre enn ${POLL_PUBLIC_PERCENT_MIN_VOTES} stemmer — vis ikke prosentandeler.`
          : null,
  };
}

export async function collectPollResults(args: {
  pollId?: string;
  issueId?: string;
  query?: string;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
  client?: ChatRagClient | null;
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

  const [totals, byFylke] = await Promise.all([
    getPollTotals(poll.id, client),
    getPollTotalsByFylke(poll.id, POLL_FYLKE_MIN_VOTES, client),
  ]);

  return shapeChatPollResults({ poll, totals, byFylke });
}

export function createPollChatTools(args: {
  client?: ChatRagClient | null;
  /** Per-request source registry so poll results can be cited as [n]. */
  citations?: CitationRegistry | null;
  resolveIssueId: (input: { issueId?: string; query?: string }) => Promise<string | null>;
}) {
  return {
    getPollResults: tool({
      description:
        'Hent resultatet av en Ja/Nei/Blank-avstemning i appen: antall og prosent per valg, om den er åpen, og fylkesfordeling når den er over personvern-terskelen. Bruk når brukeren spør hva folk stemte i en avstemning eller hvordan en sak står i avstemningen.',
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
