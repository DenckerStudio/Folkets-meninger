import Link from 'next/link';
import { RedditSpikeBadgeTabDot } from '@/components/admin/reddit-spike-badge-panel';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const tabClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ResearchViewTabs({
  active,
  spikeBadgeActive = false,
}: {
  active: 'oppfanget' | 'signaler' | 'temaer';
  spikeBadgeActive?: boolean;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Research-visninger">
      <Link
        href={routes.adminResearch}
        className={cn(
          tabClass,
          active === 'oppfanget'
            ? 'border-brand bg-brand/10 text-brand'
            : 'border-border bg-card text-foreground hover:bg-muted',
        )}
        aria-current={active === 'oppfanget' ? 'page' : undefined}
      >
        Oppfanget
      </Link>
      <Link
        href={`${routes.adminResearch}?view=signaler`}
        className={cn(
          tabClass,
          active === 'signaler'
            ? 'border-brand bg-brand/10 text-brand'
            : 'border-border bg-card text-foreground hover:bg-muted',
        )}
        aria-current={active === 'signaler' ? 'page' : undefined}
      >
        Interessesignaler
        <RedditSpikeBadgeTabDot show={spikeBadgeActive} />
      </Link>
      <Link
        href={`${routes.adminResearch}?view=temaer`}
        className={cn(
          tabClass,
          active === 'temaer'
            ? 'border-brand bg-brand/10 text-brand'
            : 'border-border bg-card text-foreground hover:bg-muted',
        )}
        aria-current={active === 'temaer' ? 'page' : undefined}
      >
        Temaer
      </Link>
    </nav>
  );
}