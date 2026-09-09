import { ReelsFeedSkeleton } from '@/components/polls/reels-feed';
import { PageHeader } from '@/components/page-header';

export default function UtforskLoading() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Utforsk saker"
        description="Lovforslag og representantforslag fra Stortinget — kildedokumenter."
      />
      <ReelsFeedSkeleton />
      <div className="animate-pulse space-y-4">
        <div className="h-12 rounded-2xl bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
