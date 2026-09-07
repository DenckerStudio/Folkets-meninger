import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import {
  PARTY_ALIGNMENT_AVAILABLE,
  stanceCountFromRpc,
  type ValgomatPartyScore,
} from '@/lib/valgomat/scores';
import { getUserStanceCount } from '@/lib/stances/service';

export type ValgomatResult = {
  scores: ValgomatPartyScore[];
  stance_count: number;
  party_alignment_available: boolean;
};

export class ValgomatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValgomatServiceError';
  }
}

export async function fetchUserStanceCount(
  service: SupabaseClient,
  userId: string,
): Promise<number> {
  const count = await getUserStanceCount(service, userId);
  return stanceCountFromRpc(count);
}

export async function getValgomatForUser(userId: string): Promise<ValgomatResult> {
  const service = getServiceSupabase();
  const stanceCount = await fetchUserStanceCount(service, userId);

  return {
    scores: [],
    stance_count: stanceCount,
    party_alignment_available: PARTY_ALIGNMENT_AVAILABLE,
  };
}
