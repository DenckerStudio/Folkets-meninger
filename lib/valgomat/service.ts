import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildValgomatPartySummaries,
  type SakPartyVotesInput,
} from '@/lib/valgomat/alignment';
import { fetchPrimaryPartyVotesForSak } from '@/lib/valgomat/party-votes';
import { PARTY_ALIGNMENT_AVAILABLE } from '@/lib/valgomat/scores';
import { loadEngagedStancesForSession } from '@/lib/valgomat/stances';
import type { ValgomatPayload } from '@/lib/valgomat/types';

export class ValgomatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValgomatServiceError';
  }
}

async function loadPartyVotesForIssues(issueIds: string[]): Promise<SakPartyVotesInput[]> {
  const results = await Promise.all(issueIds.map((id) => fetchPrimaryPartyVotesForSak(id)));
  return results
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row) => ({
      stortinget_issue_id: row.stortinget_issue_id,
      votering_tema: row.votering_tema,
      party_stances: row.party_stances,
    }));
}

export async function getValgomatForSession(supabase: SupabaseClient): Promise<ValgomatPayload> {
  const hjertesaker = await loadEngagedStancesForSession(supabase);
  const stanceCount = hjertesaker.length;

  if (stanceCount === 0) {
    return {
      hjertesaker: [],
      partisamsvar: [],
      stance_count: 0,
      party_alignment_available: PARTY_ALIGNMENT_AVAILABLE,
      comparable_issue_count: 0,
    };
  }

  const uniqueIssueIds = [...new Set(hjertesaker.map((h) => h.stortinget_issue_id))];
  const sakVotes = await loadPartyVotesForIssues(uniqueIssueIds);
  const partisamsvar = buildValgomatPartySummaries(hjertesaker, sakVotes);

  return {
    hjertesaker,
    partisamsvar,
    stance_count: stanceCount,
    party_alignment_available: PARTY_ALIGNMENT_AVAILABLE,
    comparable_issue_count: sakVotes.length,
  };
}