import { fetchSimilarSaker } from '@/lib/sak/similar-issues';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import { resolvePublicTopicAroundSakSection } from '@/lib/search/topic-around-public';
import { fetchTopicAroundSearchWithTimeout } from '@/lib/search/topic-around-search';

export async function sakPageTopicAroundWillRender(input: {
  issueId: string;
  title: string;
  summary?: string | null;
  relatedIssueIds?: readonly string[];
}): Promise<boolean> {
  if (!isTopicAroundSearchEnabled()) return false;

  const issueId = input.issueId.trim();
  if (!issueId) return false;

  const similarSaker = await fetchSimilarSaker(issueId);
  const excludeIssueIds = [
    issueId,
    ...(input.relatedIssueIds ?? []),
    ...similarSaker.map((item) => item.id),
  ];

  const result = await fetchTopicAroundSearchWithTimeout({
    query: buildTopicAroundSearchQuery({ title: input.title, summary: input.summary }),
    themeLabel: input.title,
    filters: { excludeIssueIds },
  });

  const items = resolvePublicTopicAroundSakSection({
    result,
    issueId,
    excludeIssueIds,
  });

  return Boolean(items?.length);
}