export type SakVotering = {
  votering_id: number;
  sak_id?: number;
  votering_tema?: string | null;
  votering_tid?: string | null;
  vedtatt?: boolean;
  fri_votering?: boolean;
  personlig_votering?: boolean;
  antall_for?: number;
  antall_mot?: number;
  antall_ikke_tilstede?: number;
  alternativ_votering_id?: number | null;
  votering_resultat_type_tekst?: string | null;
};

export type StortingetVoteCounts = {
  for: number;
  against: number;
  absent: number;
  decided: number;
  adopted: boolean;
};

export type AlignmentSide = 'for' | 'against' | 'tie';

export type AlignmentVerdict = 'aligned' | 'partial' | 'divergent' | 'pending' | 'insufficient';

export type FolkVoteCounts = {
  for: number;
  against: number;
  abstain: number;
  total: number;
};

export type AlignmentComparison = {
  folk: FolkVoteCounts;
  folkForPercent: number;
  folkAgainstPercent: number;
  folkAbstainPercent: number;
  folkSide: AlignmentSide;
  stortinget: StortingetVoteCounts | null;
  stortingetForPercent: number | null;
  stortingetAgainstPercent: number | null;
  stortingetSide: AlignmentSide | null;
  score: number | null;
  gapPoints: number | null;
  verdict: AlignmentVerdict;
  headline: string;
  summary: string;
  votering: SakVotering | null;
  otherVoteringCount: number;
};

export const ALIGNMENT_MIN_FOLK_VOTES = 5;
