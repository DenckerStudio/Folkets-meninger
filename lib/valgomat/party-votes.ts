import type { PartyStance } from '@/lib/stortinget-votering-rag';
import { fetchPartyStancesForVoteringId } from '@/lib/stortinget-votering-rag';
import { fetchSakVoteringer, pickPrimaryVotering } from '@/lib/stortinget-voteringer';

export type SakPartyVoteContext = {
  stortinget_issue_id: string;
  votering_id: string;
  votering_tema: string;
  party_stances: Record<string, PartyStance>;
};

/** Primary substantive votering per sak — same ranking as alignment/chat surfaces. */
export async function fetchPrimaryPartyVotesForSak(
  stortingetIssueId: string,
): Promise<SakPartyVoteContext | null> {
  const voteringer = await fetchSakVoteringer(stortingetIssueId);
  const primary = pickPrimaryVotering(voteringer);
  if (!primary || typeof primary.votering_id !== 'number') return null;

  const voteringId = String(primary.votering_id);
  const partyStances = await fetchPartyStancesForVoteringId(voteringId);
  if (!partyStances) return null;

  return {
    stortinget_issue_id: stortingetIssueId,
    votering_id: voteringId,
    votering_tema: primary.votering_tema?.trim() || 'Votering',
    party_stances: partyStances,
  };
}