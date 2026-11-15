import type { EngagedUserStance, ValgomatPartySummary } from '@/lib/valgomat/alignment';

export type ValgomatHjertesak = EngagedUserStance;

export type ValgomatPayload = {
  hjertesaker: ValgomatHjertesak[];
  partisamsvar: ValgomatPartySummary[];
  stance_count: number;
  party_alignment_available: boolean;
  comparable_issue_count: number;
};