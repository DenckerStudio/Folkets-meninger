import {
  shouldShowPublicTopicAroundSection,
  TOPIC_AROUND_PUBLIC_MIN_ITEMS,
} from '@/lib/search/topic-around-filters';
import type {
  TopicAroundSearchItem,
  TopicAroundSearchResult,
} from '@/lib/search/topic-around-search';

export function dedupeTopicAroundHitsByIssueIds(
  items: readonly TopicAroundSearchItem[],
  excludeIssueIds: readonly string[],
): TopicAroundSearchItem[] {
  const exclude = new Set(excludeIssueIds.map((id) => id.trim()).filter(Boolean));
  return items.filter((item) => !exclude.has(item.issueId.trim()));
}

export function logTopicAroundPublicSkipped(
  issueId: string,
  reason: string,
  detail?: Record<string, unknown>,
): void {
  console.warn('[topic-around] public sak: skjuler seksjon', {
    issueId,
    reason,
    ...detail,
  });
}

/**
 * Offentlig saksside: ingen feil-UI — returner null ved feil, for få treff eller tom liste
 * (samme som under k-terskel). Admin bruker rå `fetchTopicAroundSearch`-resultat.
 */
export function resolvePublicTopicAroundSakSection(input: {
  result: TopicAroundSearchResult;
  issueId: string;
  excludeIssueIds?: readonly string[];
}): TopicAroundSearchItem[] | null {
  const issueId = input.issueId.trim();
  if (!issueId) return null;

  if (!input.result.ok) {
    if (input.result.reason !== 'disabled') {
      logTopicAroundPublicSkipped(issueId, input.result.reason);
    }
    return null;
  }

  const exclude = new Set<string>([issueId]);
  for (const raw of input.excludeIssueIds ?? []) {
    const id = raw.trim();
    if (id) exclude.add(id);
  }

  const deduped = dedupeTopicAroundHitsByIssueIds(input.result.items, [...exclude]);
  if (!shouldShowPublicTopicAroundSection(deduped.length)) {
    if (deduped.length > 0) {
      logTopicAroundPublicSkipped(issueId, 'below_public_threshold', {
        count: deduped.length,
        min: TOPIC_AROUND_PUBLIC_MIN_ITEMS,
      });
    }
    return null;
  }

  return deduped;
}

export { TOPIC_AROUND_PUBLIC_MIN_ITEMS };