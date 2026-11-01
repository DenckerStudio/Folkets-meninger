'use client';

import { useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { AiSummaryReview } from '@/components/admin/ai-summary-review';
import { BlogDraftReview } from '@/components/admin/blog-draft-review';
import { ReelDraftReview } from '@/components/admin/reel-draft-review';
import { parseVurderTab, VURDER_TABS, type VurderTabId } from '@/lib/admin/vurder-tabs';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export function VurderPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Laster vurdering">
      <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
      <div className="h-12 w-full max-w-lg animate-pulse rounded-xl bg-muted/40" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted/30" />
    </div>
  );
}

function VurderPanel({ tab }: { tab: VurderTabId }) {
  switch (tab) {
    case 'reels':
      return <ReelDraftReview />;
    case 'blogg':
      return <BlogDraftReview />;
    case 'sammendrag':
      return <AiSummaryReview />;
    default: {
      const unreachable: never = tab;
      return unreachable;
    }
  }
}

export default function AdminVurderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tablistId = useId();
  const tab = parseVurderTab(searchParams.get('fane'));

  function selectTab(next: VurderTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('fane', next);
    if (next !== 'reels') params.delete('pollId');
    router.replace(`${routes.adminVurder}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <ClipboardCheck className="h-6 w-6 shrink-0 text-brand" aria-hidden />
          Vurder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Samlet vurdering av reels, blogginnlegg og sammendrag.
        </p>
      </div>

      <div
        className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1 [scrollbar-width:none] sm:mx-0 sm:snap-none sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Innhold som skal vurderes"
      >
        {VURDER_TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={`${tablistId}-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`${tablistId}-${item.id}-panel`}
              onClick={() => selectTab(item.id)}
              className={cn(
                'inline-flex min-h-11 shrink-0 snap-start items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 sm:flex-1 sm:shrink sm:snap-align-none sm:px-4 sm:min-w-[8.5rem]',
                VURDER_FOCUS_RING,
                selected
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <section
        id={`${tablistId}-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`${tablistId}-${tab}`}
      >
        <VurderPanel tab={tab} />
      </section>

      <AdminBackLink />
    </div>
  );
}
