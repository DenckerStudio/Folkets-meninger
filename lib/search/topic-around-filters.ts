import type { SakDocumentKind } from '@/lib/stortinget-documents';
import { SAK_DOCUMENT_KIND_LABELS } from '@/lib/stortinget-documents';
import { MIN_PUBLIC_AGGREGATE_N } from '@/lib/public-aggregate/constants';

export const TOPIC_AROUND_SORTS = ['relevance', 'date'] as const;
export type TopicAroundSort = (typeof TOPIC_AROUND_SORTS)[number];

export const TOPIC_AROUND_PERIODS = ['all', '12m', '24m', '48m'] as const;
export type TopicAroundPeriod = (typeof TOPIC_AROUND_PERIODS)[number];

export const TOPIC_AROUND_FILTERABLE_KINDS: SakDocumentKind[] = [
  'lovforslag',
  'representantforslag',
  'innstilling',
  'referat',
  'horing',
  'annet',
];

export const TOPIC_AROUND_KIND_OPTIONS = TOPIC_AROUND_FILTERABLE_KINDS.map((kind) => ({
  value: kind,
  label: SAK_DOCUMENT_KIND_LABELS[kind],
}));

const KIND_TO_DB_TYPES: Record<SakDocumentKind, readonly string[]> = {
  lovforslag: ['lovforslag', 'proposisjon', 'prop'],
  representantforslag: ['representantforslag', 'dok8'],
  innstilling: ['innstilling', 'inns'],
  referat: ['referat', 'refs', 'refe'],
  horing: ['horing', 'horingsoversikt'],
  annet: ['annet'],
};

export function documentKindsToRpcFilter(
  kinds: readonly SakDocumentKind[] | null | undefined,
): string[] | null {
  if (!kinds?.length) return null;
  const out = new Set<string>();
  for (const kind of kinds) {
    const mapped = KIND_TO_DB_TYPES[kind];
    if (mapped) {
      for (const value of mapped) out.add(value);
    }
  }
  return out.size > 0 ? [...out] : null;
}

export function periodToPublishedAfter(period: TopicAroundPeriod): string | null {
  if (period === 'all') return null;
  const months = period === '12m' ? 12 : period === '24m' ? 24 : 48;
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

export function parseTopicAroundSort(raw: string | null | undefined): TopicAroundSort {
  const value = (raw ?? '').trim().toLowerCase();
  return TOPIC_AROUND_SORTS.includes(value as TopicAroundSort)
    ? (value as TopicAroundSort)
    : 'relevance';
}

export function parseTopicAroundPeriod(raw: string | null | undefined): TopicAroundPeriod {
  const value = (raw ?? '').trim().toLowerCase();
  return TOPIC_AROUND_PERIODS.includes(value as TopicAroundPeriod)
    ? (value as TopicAroundPeriod)
    : 'all';
}

export function parseTopicAroundDocumentKinds(
  raw: string | null | undefined,
): SakDocumentKind[] | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(',').map((p) => p.trim().toLowerCase());
  const selected = TOPIC_AROUND_FILTERABLE_KINDS.filter((kind) => parts.includes(kind));
  return selected.length > 0 ? selected : null;
}

export function shouldShowPublicTopicAroundSection(itemCount: number): boolean {
  return itemCount >= MIN_PUBLIC_AGGREGATE_N;
}

export const TOPIC_AROUND_PUBLIC_MIN_ITEMS = MIN_PUBLIC_AGGREGATE_N;