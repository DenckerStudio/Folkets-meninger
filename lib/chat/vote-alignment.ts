import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildAlignmentComparison } from '@/lib/alignment/score';
import { redactPublicFolkForTool } from '@/lib/public-aggregate/folk-public-output';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import { fetchSakVedtakContext } from '@/lib/alignment/sak-vedtak';
import type { AlignmentComparison, FolkVoteCounts } from '@/lib/alignment/types';
import { findOpenStortingetPollForIssue, type PollReadClient } from '@/lib/polls/service';
import { fetchSakVoteringer } from '@/lib/stortinget-voteringer';
import { resolveChatRagClient, type ChatRagClient } from '@/lib/chat/rag';

export type ChatRpcClient = Pick<SupabaseClient, 'rpc'>;

export type VoteAlignmentResult = {
  hasStortingetVote: boolean;
  stortinget: AlignmentComparison['stortinget'];
  stortingetForPercent: number | null;
  stortingetAgainstPercent: number | null;
  folk: FolkVoteCounts;
  folkForPercent: number | null;
  folkAgainstPercent: number | null;
  folkAbstainPercent: number | null;
  score: number | null;
  gapPoints: number | null;
  verdict: AlignmentComparison['verdict'];
  headline: string;
  summary: string;
  voteringTema: string | null;
  otherVoteringCount: number;
  /** Open Nei/Blank/Ja poll on this sak, when one exists. */
  openPollId: string | null;
};

const EMPTY_FOLK: FolkVoteCounts = { for: 0, against: 0, abstain: 0, total: 0 };

export function parseFolkTotals(data: unknown): FolkVoteCounts {
  if (!data || typeof data !== 'object') return { ...EMPTY_FOLK };
  const record = data as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 0);
  const forCount = num(record.for);
  const against = num(record.against);
  const abstain = num(record.abstain);
  const total = num(record.total) || forCount + against + abstain;
  return { for: forCount, against, abstain, total };
}

export function shapeVoteAlignment(comparison: AlignmentComparison): VoteAlignmentResult {
  return {
    hasStortingetVote: comparison.stortinget != null,
    stortinget: comparison.stortinget,
    stortingetForPercent: comparison.stortingetForPercent,
    stortingetAgainstPercent: comparison.stortingetAgainstPercent,
    folk: comparison.folk,
    folkForPercent: publicAggregateMeetsThreshold(comparison.folk.total)
      ? comparison.folkForPercent
      : null,
    folkAgainstPercent: publicAggregateMeetsThreshold(comparison.folk.total)
      ? comparison.folkAgainstPercent
      : null,
    folkAbstainPercent: publicAggregateMeetsThreshold(comparison.folk.total)
      ? comparison.folkAbstainPercent
      : null,
    score: comparison.score,
    gapPoints: comparison.gapPoints,
    verdict: comparison.verdict,
    headline: comparison.headline,
    summary: comparison.summary,
    voteringTema: comparison.votering?.votering_tema ?? null,
    otherVoteringCount: comparison.otherVoteringCount,
    openPollId: null,
  };
}

async function resolveRpcClient(explicit?: ChatRagClient | null): Promise<ChatRpcClient | null> {
  if (explicit) return explicit as unknown as ChatRpcClient;
  if (
    !(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    )
  ) {
    return null;
  }
  try {
    return await getServerSupabase();
  } catch {
    return getAnonSupabase();
  }
}

async function fetchFolkTotals(
  issueId: string,
  clientArg?: ChatRagClient | null,
): Promise<FolkVoteCounts> {
  const client = await resolveRpcClient(clientArg);
  if (!client) return { ...EMPTY_FOLK };
  try {
    const { data, error } = await client.rpc('get_issue_vote_totals', { p_issue_id: issueId });
    if (error) return { ...EMPTY_FOLK };
    return parseFolkTotals(data);
  } catch {
    return { ...EMPTY_FOLK };
  }
}

/**
 * Stortinget votering + folkets anonyme For/Mot/Avstår for one sak, shaped for chat.
 * Never uses the service role: `get_issue_vote_totals` is granted to anon/authenticated.
 */
export async function fetchVoteAlignment(args: {
  issueId: string;
  client?: ChatRagClient | null;
}): Promise<VoteAlignmentResult | null> {
  const issueId = args.issueId.trim();
  if (!issueId) return null;
  const ragClient = await resolveChatRagClient(args.client);
  const [voteringer, folk, sakVedtak, openPoll] = await Promise.all([
    fetchSakVoteringer(issueId),
    fetchFolkTotals(issueId, args.client),
    fetchSakVedtakContext(issueId),
    ragClient
      ? findOpenStortingetPollForIssue(issueId, ragClient as PollReadClient)
      : Promise.resolve(null),
  ]);
  const shaped = shapeVoteAlignment(buildAlignmentComparison(folk, voteringer, sakVedtak));
  const withPoll = { ...shaped, openPollId: openPoll?.id ?? null };
  return redactPublicFolkForTool(withPoll);
}
