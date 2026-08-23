import Link from 'next/link';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type AvstemningerTabsProps = {
  active: 'alle' | 'reels';
};

export function AvstemningerTabs({ active }: AvstemningerTabsProps) {
  return (
    <nav
      className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1"
      aria-label="Avstemninger"
    >
      <Link
        href={routes.avstemninger}
        className={cn(
          'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
          active === 'alle'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-current={active === 'alle' ? 'page' : undefined}
      >
        Alle
      </Link>
      <Link
        href={routes.avstemningerReels}
        className={cn(
          'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
          active === 'reels'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-current={active === 'reels' ? 'page' : undefined}
      >
        Reels
      </Link>
    </nav>
  );
}
