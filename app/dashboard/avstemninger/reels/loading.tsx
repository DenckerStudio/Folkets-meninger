import { ReelsFeedSkeleton } from '@/components/polls/reels-feed';
import { AvstemningerTabs } from '@/components/polls/avstemninger-tabs';
import { PageHeader } from '@/components/page-header';

export default function AvstemningerReelsLoading() {
  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Reels"
        description="Én systemgenerert ja/nei/blank-spørsmål om gangen. Bla videre for neste."
      />
      <AvstemningerTabs active="reels" />
      <ReelsFeedSkeleton />
    </div>
  );
}
