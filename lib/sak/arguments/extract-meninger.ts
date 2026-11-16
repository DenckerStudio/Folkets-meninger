import { createHash } from 'crypto';
import type { OpinionListItem, OpinionPointStance } from '@/lib/opinions/types';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';
import { routes } from '@/lib/routes';
import type { SakArgumentItem } from '@/lib/sak/arguments/types';

function stableId(prefix: string, text: string): string {
  return `${prefix}-${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

function normalizePointText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function aggregateOpinionArguments(args: {
  sakId: string;
  opinions: readonly OpinionListItem[];
  totalOpinions: number;
}): SakArgumentItem[] {
  if (args.totalOpinions < MIN_PUBLIC_AGGREGATE_N) return [];

  const tallies = new Map<string, { side: OpinionPointStance; text: string; count: number }>();

  for (const opinion of args.opinions) {
    for (const point of opinion.points) {
      if (point.stance !== 'for' && point.stance !== 'imot') continue;
      const text = normalizePointText(point.text);
      if (text.length < 12) continue;
      const key = `${point.stance}:${text.toLowerCase()}`;
      const existing = tallies.get(key);
      if (existing) existing.count += 1;
      else tallies.set(key, { side: point.stance, text, count: 1 });
    }
  }

  const href = routes.folketsMeningerForSak(args.sakId);

  return [...tallies.values()]
    .filter((row) => row.count >= MIN_PUBLIC_AGGREGATE_N)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((row) => ({
      id: stableId('mening', `${row.side}:${row.text}`),
      side: row.side === 'imot' ? 'mot' : 'for',
      text: row.text,
      supportCount: row.count,
      source: {
        kind: 'mening',
        label: `${row.count} offentlige meninger`,
        href,
        anchorId: 'sak-meninger',
      },
    }));
}