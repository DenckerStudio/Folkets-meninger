import { SakSectionHeading } from '@/components/sak/sak-meta';
import { TopicAroundHitList } from '@/components/search/topic-around-hit-list';
import { fetchSimilarSaker } from '@/lib/sak/similar-issues';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import { resolvePublicTopicAroundSakSection } from '@/lib/search/topic-around-public';
import { fetchTopicAroundSearchWithTimeout } from '@/lib/search/topic-around-search';

export type TopicAroundSakSectionContentProps = {
  issueId: string;
  title: string;
  summary?: string | null;
  relatedIssueIds?: readonly string[];
};

export async function TopicAroundSakSectionContent({
  issueId,
  title,
  summary,
  relatedIssueIds = [],
}: TopicAroundSakSectionContentProps) {
  if (!isTopicAroundSearchEnabled()) {
    return null;
  }

  const similarSaker = await fetchSimilarSaker(issueId);
  const excludeIssueIds = [
    issueId,
    ...relatedIssueIds,
    ...similarSaker.map((item) => item.id),
  ];

  const result = await fetchTopicAroundSearchWithTimeout({
    query: buildTopicAroundSearchQuery({ title, summary }),
    themeLabel: title,
    filters: { excludeIssueIds },
  });

  const items = resolvePublicTopicAroundSakSection({
    result,
    issueId,
    excludeIssueIds,
  });

  if (!items?.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <SakSectionHeading title="Søk rundt temaet" icon="file-text" iconClassName="w-5 h-5 text-brand" />
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Dokumentutdrag fra andre saker som berører samme tema — ikke de samme sakene som under
        «Liknende saker».
      </p>
      <TopicAroundHitList items={items} />
    </section>
  );
}