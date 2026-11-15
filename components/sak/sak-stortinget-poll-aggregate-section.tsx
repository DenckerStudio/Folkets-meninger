import { Suspense } from 'react';
import { SakStortingetPollAggregate } from '@/components/sak/sak-stortinget-poll-aggregate';

function SakPollAggregateSkeleton() {
  return (
    <section
      className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5"
      aria-busy="true"
      aria-label="Laster avstemningsresultat"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </section>
  );
}

export function SakStortingetPollAggregateSection({ sakId }: { sakId: string }) {
  return (
    <Suspense fallback={<SakPollAggregateSkeleton />}>
      <SakStortingetPollAggregate sakId={sakId} />
    </Suspense>
  );
}