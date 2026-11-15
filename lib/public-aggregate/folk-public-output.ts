import type { FolkVoteCounts } from '@/lib/alignment/types';
import {
  folkPublicBreakdownRedacted,
  publicAggregateMeetsThreshold,
} from '@/lib/public-aggregate/threshold';

export type PublicFolkChoiceFields = FolkVoteCounts;

export const FOLK_BREAKDOWN_BELOW_THRESHOLD_NOTE =
  'Folkets For/Mot/Avstår-fordeling er skjult fordi færre enn 5 historiske anonyme stemmer er registrert. Oppgi ingen prosentandeler eller antall per valg.';

export function folkVoteTotal(counts: FolkVoteCounts): number {
  if (counts.total > 0) return counts.total;
  return (counts.for ?? 0) + (counts.against ?? 0) + (counts.abstain ?? 0);
}

export function redactPublicFolkChoiceFields(counts: FolkVoteCounts): PublicFolkChoiceFields {
  const total = folkVoteTotal(counts);
  if (folkPublicBreakdownRedacted(total)) {
    return { for: null, against: null, abstain: null, total };
  }
  return {
    for: counts.for ?? 0,
    against: counts.against ?? 0,
    abstain: counts.abstain ?? 0,
    total,
  };
}

export function publicFolkPercents(
  folk: FolkVoteCounts,
  folkTotal: number,
): { folkForPercent: number; folkAgainstPercent: number; folkAbstainPercent: number } {
  if (!publicAggregateMeetsThreshold(folkTotal)) {
    return { folkForPercent: 0, folkAgainstPercent: 0, folkAbstainPercent: 0 };
  }
  const percent = (part: number, total: number) => (total <= 0 ? 0 : Math.round((part / total) * 100));
  return {
    folkForPercent: percent(folk.for ?? 0, folkTotal),
    folkAgainstPercent: percent(folk.against ?? 0, folkTotal),
    folkAbstainPercent: percent(folk.abstain ?? 0, folkTotal),
  };
}

export type PublicFolkPercentsNullable = {
  folkForPercent: number | null;
  folkAgainstPercent: number | null;
  folkAbstainPercent: number | null;
};

export function publicFolkPercentsNullable(
  folk: FolkVoteCounts,
): PublicFolkPercentsNullable {
  const total = folkVoteTotal(folk);
  if (!publicAggregateMeetsThreshold(total)) {
    return { folkForPercent: null, folkAgainstPercent: null, folkAbstainPercent: null };
  }
  const p = publicFolkPercents(folk, total);
  return {
    folkForPercent: p.folkForPercent,
    folkAgainstPercent: p.folkAgainstPercent,
    folkAbstainPercent: p.folkAbstainPercent,
  };
}

export type FolkToolRedactionFields = {
  belowPublicThreshold: boolean;
  folkBreakdownNote: string | null;
};

/** Strip per-choice folk fields from chat/LLM tool payloads when below k-anonymity floor. */
export function redactPublicFolkForTool<
  T extends {
    folk: FolkVoteCounts;
    folkForPercent: number | null;
    folkAgainstPercent: number | null;
    folkAbstainPercent: number | null;
  },
>(result: T): T & FolkToolRedactionFields {
  const total = folkVoteTotal(result.folk);
  if (!folkPublicBreakdownRedacted(total)) {
    return {
      ...result,
      belowPublicThreshold: false,
      folkBreakdownNote: null,
    };
  }
  const percents = publicFolkPercentsNullable(result.folk);
  return {
    ...result,
    folk: { for: null, against: null, abstain: null, total },
    folkForPercent: percents.folkForPercent,
    folkAgainstPercent: percents.folkAgainstPercent,
    folkAbstainPercent: percents.folkAbstainPercent,
    belowPublicThreshold: true,
    folkBreakdownNote: FOLK_BREAKDOWN_BELOW_THRESHOLD_NOTE,
  };
}