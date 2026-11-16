import type { OpinionListItem } from '@/lib/opinions/types';
import type { SakArgumentsBundle } from '@/lib/sak/arguments/types';
import { extractInnstillingArguments } from '@/lib/sak/arguments/extract-innstilling';
import { extractMerknadArguments, type MerknadChunk } from '@/lib/sak/arguments/extract-merknader';
import { aggregateOpinionArguments } from '@/lib/sak/arguments/extract-meninger';

const MAX_PER_SIDE = 8;

function capSide<T extends { side: 'for' | 'mot'; text: string }>(items: T[]): { for: T[]; mot: T[] } {
  const sorted = [...items].sort((a, b) => a.text.length - b.text.length);
  return {
    for: sorted.filter((item) => item.side === 'for').slice(0, MAX_PER_SIDE),
    mot: sorted.filter((item) => item.side === 'mot').slice(0, MAX_PER_SIDE),
  };
}

export function buildSakArgumentsBundle(args: {
  sakId: string;
  innstillingstekst: string | null | undefined;
  merknadChunks: readonly MerknadChunk[];
  opinions: readonly OpinionListItem[];
  totalOpinions: number;
}): SakArgumentsBundle {
  const combined = [
    ...extractInnstillingArguments(args.innstillingstekst),
    ...extractMerknadArguments(args.merknadChunks),
    ...aggregateOpinionArguments({
      sakId: args.sakId,
      opinions: args.opinions,
      totalOpinions: args.totalOpinions,
    }),
  ];

  const { for: forItems, mot: motItems } = capSide(combined);

  const emptyMessage =
    forItems.length === 0 && motItems.length === 0
      ? 'Vi fant ingen tydelige argumenter i innstilling, merknader eller meninger for denne saken.'
      : null;

  return { for: forItems, mot: motItems, emptyMessage };
}