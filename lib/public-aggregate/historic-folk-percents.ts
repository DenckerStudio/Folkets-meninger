import { largestRemainderPercents } from '@/lib/math/largest-remainder';
import {
  HISTORIC_FOLK_BALLOT_ORDER,
  type HistoricFolkBallotSide,
} from '@/lib/public-aggregate/historic-folk-ballot-labels';

type HistoricFolkCounts = { for: number; against: number; abstain: number };

function historicCount(issue: HistoricFolkCounts, side: HistoricFolkBallotSide): number {
  switch (side) {
    case 'for':
      return issue.for;
    case 'against':
      return issue.against;
    case 'abstain':
      return issue.abstain;
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

export function historicFolkPercents(issue: HistoricFolkCounts): Record<HistoricFolkBallotSide, number> {
  const weights = HISTORIC_FOLK_BALLOT_ORDER.map((side) => historicCount(issue, side));
  const percents = largestRemainderPercents(weights);
  return Object.fromEntries(
    HISTORIC_FOLK_BALLOT_ORDER.map((side, index) => [side, percents[index] ?? 0]),
  ) as Record<HistoricFolkBallotSide, number>;
}