import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CivicBubble } from '@/components/icons/civic';
import { routes } from '@/lib/routes';

export type ReelPromo = {
  id: string;
  title: string;
  neutralSummary: string;
};

/**
 * A Reel prompt rendered inline in the Folkets meninger feed (B7). Links into
 * the Reels carousel on Utforsk with the poll preselected.
 */
export function ReelPromoCard({ reel }: { reel: ReelPromo }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand/25 bg-brand-soft/40 p-5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
        <CivicBubble className="h-3.5 w-3.5" />
        Stem raskt · Reel
      </span>
      <p className="mt-2 text-lg font-semibold text-foreground">{reel.title}</p>
      {reel.neutralSummary ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{reel.neutralSummary}</p>
      ) : null}
      <Link
        href={routes.utforskReels(reel.id)}
        className="mt-3 inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
      >
        Stem nå
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Link>
    </div>
  );
}
