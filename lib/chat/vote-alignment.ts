import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildAlignmentComparison } from '@/lib/alignment/score';
import { fetchSakVedtakContext } from '@/lib/alignment/sak-vedtak';
import type { AlignmentComparison, FolkVoteCounts } from '@/lib/alignment/types';
import { fetchSakVoteringer } from '@/lib/stortinget-voteringer';
import type { ChatRagClient } from '@/lib/chat/rag';

export type ChatRpcClient = Pick<SupabaseClient, 'rpc'>;

export type VoteAlignmentResult = {
  hasStortingetVote: boolean;
  stortinget: AlignmentComparison['stortinget'];
  stortingetForPercent: number | null;
  stortingetAgainstPercent: number | null;
  folk: FolkVoteCounts;
  folkForPercent: number;
  folkAgainstPercent: number;
  folkAbstainPercent: number;
  score: number | null;
  gapPoints: number | null;
  verdict: AlignmentComparison['verdict'];
  headline: string;
  summary: string;
  voteringTema: string | null;
  otherVoteringCount: number;
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
    folkForPercent: comparison.folkForPercent,
    folkAgainstPercent: comparison.folkAgainstPercent,
    folkAbstainPercent: comparison.folkAbstainPercent,
    score: comparison.score,
    gapPoints: comparison.gapPoints,
    verdict: comparison.verdict,
    headline: comparison.headline,
    summary: comparison.summary,
    voteringTema: comparison.votering?.votering_tema ?? null,
    otherVoteringCount: comparison.otherVoteringCount,
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
  const [voteringer, folk, sakVedtak] = await Promise.all([
    fetchSakVoteringer(issueId),
    fetchFolkTotals(issueId, args.client),
    fetchSakVedtakContext(issueId),
  ]);
  return shapeVoteAlignment(buildAlignmentComparison(folk, voteringer, sakVedtak));
}
