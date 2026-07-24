import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import {
  buildForumVoteInsights,
  fetchUserForumVoteHistory,
  type ForumVoteInsights,
} from '@/lib/forum/vote-history-service';
import {
  PARTY_ALIGNMENT_AVAILABLE,
  type ValgomatPartyScore,
} from '@/lib/valgomat/scores';

export type ValgomatResult = {
  scores: ValgomatPartyScore[];
  vote_count: number;
  party_alignment_available: boolean;
  insights: ForumVoteInsights;
};

export class ValgomatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValgomatServiceError';
  }
}

export async function fetchUserForumVoteInsights(
  service: SupabaseClient,
  userId: string,
): Promise<ForumVoteInsights> {
  const items = await fetchUserForumVoteHistory(service, userId);
  return buildForumVoteInsights(items);
}

export async function getValgomatForUser(userId: string): Promise<ValgomatResult> {
  const service = getServiceSupabase();
  const insights = await fetchUserForumVoteInsights(service, userId);

  return {
    scores: [],
    vote_count: insights.summary.total,
    party_alignment_available: PARTY_ALIGNMENT_AVAILABLE,
    insights,
  };
}
