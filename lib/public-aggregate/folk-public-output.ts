import type { FolkVoteCounts } from '@/lib/alignment/types';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';

export type PublicFolkChoiceFields = {
  for: number | null;
  against: number | null;
  abstain: number | null;
  total: number;
};

export function redactPublicFolkChoiceFields(counts: FolkVoteCounts): PublicFolkChoiceFields {
  const total = counts.total || counts.for + counts.against + counts.abstain;
  if (!publicAggregateMeetsThreshold(total)) {
    return { for: null, against: null, abstain: null, total };
  }
  return {
    for: counts.for,
    against: counts.against,
    abstain: counts.abstain,
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
    folkForPercent: percent(folk.for, folkTotal),
    folkAgainstPercent: percent(folk.against, folkTotal),
    folkAbstainPercent: percent(folk.abstain, folkTotal),
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
  const total = folk.total || folk.for + folk.against + folk.abstain;
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

/** Strip per-choice folk fields from chat/LLM tool payloads when below k-anonymity floor. */
export function redactPublicFolkForTool<
  T extends {
    folk: FolkVoteCounts;
    folkForPercent: number | null;
    folkAgainstPercent: number | null;
    folkAbstainPercent: number | null;
  },
>(result: T): T {
  const total = result.folk.total || result.folk.for + result.folk.against + result.folk.abstain;
  if (publicAggregateMeetsThreshold(total)) {
    return result;
  }
  const percents = publicFolkPercentsNullable(result.folk);
  return {
    ...result,
    folk: { for: 0, against: 0, abstain: 0, total },
    folkForPercent: percents.folkForPercent,
    folkAgainstPercent: percents.folkAgainstPercent,
    folkAbstainPercent: percents.folkAbstainPercent,
  };
}