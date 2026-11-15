/**
 * User-facing labels for archived folk votes (stored as for/against/abstain).
 * Stortinget voteringer keep For/Mot separately.
 */
export type HistoricFolkBallotSide = 'for' | 'against' | 'abstain';

export const HISTORIC_FOLK_BALLOT_ORDER: HistoricFolkBallotSide[] = ['against', 'abstain', 'for'];

export function historicFolkBallotLabel(side: HistoricFolkBallotSide): string {
  switch (side) {
    case 'against':
      return 'Nei';
    case 'abstain':
      return 'Blank';
    case 'for':
      return 'Ja';
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}