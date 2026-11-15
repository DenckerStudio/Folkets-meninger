import { Suspense } from 'react';
import {
  TopicAroundSakSectionContent,
  type TopicAroundSakSectionContentProps,
} from '@/components/search/topic-around-sak-section-content';
import { TopicAroundSakSectionSkeleton } from '@/components/search/topic-around-sak-section-skeleton';

export type TopicAroundSakSectionProps = TopicAroundSakSectionContentProps;

export function TopicAroundSakSection(props: TopicAroundSakSectionProps) {
  return (
    <Suspense fallback={<TopicAroundSakSectionSkeleton />}>
      <TopicAroundSakSectionContent {...props} />
    </Suspense>
  );
}

export { TOPIC_AROUND_PUBLIC_MIN_ITEMS } from '@/lib/search/topic-around-public';