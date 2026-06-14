import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import {
  PARTY_ALIGNMENT_AVAILABLE,
  voteCountFromHistoryRpc,
  type ValgomatPartyScore,
} from '@/lib/valgomat/scores';

export type ValgomatResult = {
  scores: ValgomatPartyScore[];
  vote_count: number;
  party_alignment_available: boolean;
};

export class ValgomatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValgomatServiceError';
  }
}

export async function fetchUserVoteCount(
  service: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await service.rpc('get_user_vote_history', {
    p_user_id: userId,
  });

  if (error) {
    throw new ValgomatServiceError(error.message);
  }

  return voteCountFromHistoryRpc(data);
}

export async function getValgomatForUser(userId: string): Promise<ValgomatResult> {
  const service = getServiceSupabase();
  const voteCount = await fetchUserVoteCount(service, userId);

  return {
    scores: [],
    vote_count: voteCount,
    party_alignment_available: PARTY_ALIGNMENT_AVAILABLE,
  };
}
