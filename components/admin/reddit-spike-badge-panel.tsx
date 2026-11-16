import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import {
  buildSpikeItemAdminHref,
  type RedditSpikeBadgeView,
} from '@/lib/reddit-signals/spike-badge';
import { cn } from '@/lib/utils';

const itemLinkClass =
  'inline-flex min-h-11 items-center rounded-full border border-brand/40 bg-brand/10 px-3 text-xs font-medium text-brand hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function RedditSpikeBadgeTabDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 inline-flex items-center gap-1">
      <span className="inline-flex h-2 w-2 rounded-full bg-brand" aria-hidden />
      <span className="sr-only">Aktive vekstmarkeringer</span>
    </span>
  );
}

export function RedditSpikeBadgePanel({ badge }: { badge: RedditSpikeBadgeView | null }) {
  if (!badge || badge.items.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3"
      aria-label="Vekstmarkeringer"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
          Vekst nå
        </span>
        <ul className="flex flex-wrap gap-2">
          {badge.items.map((item) => {
            const href = buildSpikeItemAdminHref(item);
            const key = `${item.kind}:${item.redditId ?? item.signalId ?? item.clusterId}`;
            return (
              <li key={key}>
                <Link href={href} className={itemLinkClass}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Markeringene kommer fra innhentingskonfigurasjon og viser innlegg eller klynger med uvanlig
        vekst. Klikk for å filtrere listen.
      </p>
    </section>
  );
}

export function RedditSpikeActiveRowMark() {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand',
      )}
    >
      <TrendingUp className="h-3 w-3" aria-hidden />
      Vekst
    </span>
  );
}