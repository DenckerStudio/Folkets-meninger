import { Suspense } from 'react';
import { PublicResearchTopicPollPanel } from '@/components/research-topics/public-research-topic-poll-panel';

function PublicPollPanelSkeleton() {
  return (
    <section
      className="rounded-2xl border border-dashed border-[#00205b]/15 bg-[#00205b]/[0.02] p-5"
      aria-busy="true"
      aria-label="Laster avstemning"
    >
      <div className="h-5 w-40 animate-pulse rounded bg-[#00205b]/10" />
      <div className="mt-4 h-24 animate-pulse rounded-xl bg-[#00205b]/10" />
    </section>
  );
}

type Props = {
  pollId: string;
  topicPath: string;
};

export function PublicResearchTopicPollPanelSection({ pollId, topicPath }: Props) {
  return (
    <Suspense fallback={<PublicPollPanelSkeleton />}>
      <PublicResearchTopicPollPanel pollId={pollId} topicPath={topicPath} />
    </Suspense>
  );
}