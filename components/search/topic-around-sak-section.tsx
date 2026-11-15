import { SakSectionHeading } from '@/components/sak/sak-meta';
import { TopicAroundHitList } from '@/components/search/topic-around-hit-list';
import { TopicAroundSakSectionClient } from '@/components/search/topic-around-sak-section-client';
import { buildTopicAroundSearchQuery } from '@/lib/search/topic-around-query';
import {
  shouldShowPublicTopicAroundSection,
  TOPIC_AROUND_PUBLIC_MIN_ITEMS,
} from '@/lib/search/topic-around-filters';
import { isTopicAroundSearchEnabled } from '@/lib/search/topic-around-enabled';
import { fetchTopicAroundSearch } from '@/lib/search/topic-around-search';

type TopicAroundSakSectionProps = {
  issueId: string;
  title: string;
  summary?: string | null;
};

export async function TopicAroundSakSection({
  issueId,
  title,
  summary,
}: TopicAroundSakSectionProps) {
  if (!isTopicAroundSearchEnabled()) {
    return null;
  }

  const result = await fetchTopicAroundSearch({
    query: buildTopicAroundSearchQuery({ title, summary }),
    themeLabel: title,
    filters: { excludeIssueIds: [issueId] },
  });

  if (result.ok === false) {
    if (result.reason === 'disabled') return null;
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <SakSectionHeading title="Søk rundt temaet" icon="file-text" iconClassName="w-5 h-5 text-brand" />
        <TopicAroundSakSectionClient
          issueId={issueId}
          initialError={
            result.reason === 'embedding_unavailable'
              ? 'Embedding-tjenesten svarer ikke. Prøv igjen om litt.'
              : 'Søket feilet. Prøv igjen.'
          }
        />
      </section>
    );
  }

  if (!shouldShowPublicTopicAroundSection(result.items.length)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <SakSectionHeading title="Søk rundt temaet" icon="file-text" iconClassName="w-5 h-5 text-brand" />
      <TopicAroundHitList items={result.items} className="mt-4" />
    </section>
  );
}

export { TOPIC_AROUND_PUBLIC_MIN_ITEMS };