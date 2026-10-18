import Link from 'next/link';
import { Landmark, Megaphone } from 'lucide-react';
import { BLOG_AGGREGATE_DISCLOSURE } from '@/lib/blog/constants';
import type { BlogRelatedHoringCard, BlogRelatedSakCard } from '@/lib/blog/related-context';
import { cn } from '@/lib/utils';

type BlogRelatedCardsProps = {
  saker: BlogRelatedSakCard[];
  horinger: BlogRelatedHoringCard[];
  className?: string;
};

export function BlogRelatedCards({ saker, horinger, className }: BlogRelatedCardsProps) {
  if (saker.length === 0 && horinger.length === 0) return null;

  return (
    <aside className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold text-[#001433]">Relatert i appen</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {saker.map((sak) => (
          <li key={`sak-${sak.id}`}>
            <Link
              href={sak.href}
              className="flex h-full flex-col rounded-xl border border-[#00205b]/10 bg-white p-4 shadow-sm transition-colors hover:border-[#ba0c2f]/30 hover:bg-[#00205b]/[0.02]"
            >
              <div className="flex items-start gap-3">
                <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-[#00205b]" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-[#001433] line-clamp-3">{sak.title}</p>
                  {sak.folkTotal != null ? (
                    <p className="mt-2 text-sm text-[#001433]/65">
                      {sak.folkTotal} anonyme stemmer i appen
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[#001433]/55">Åpne sakssiden for å lese og stemme</p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {horinger.map((horing) => (
          <li key={`horing-${horing.id}`}>
            <Link
              href={horing.href}
              className="flex h-full flex-col rounded-xl border border-[#00205b]/10 bg-white p-4 shadow-sm transition-colors hover:border-[#ba0c2f]/30 hover:bg-[#00205b]/[0.02]"
            >
              <div className="flex items-start gap-3">
                <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-[#ba0c2f]" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-[#001433] line-clamp-3">{horing.title}</p>
                  {horing.subtitle ? (
                    <p className="mt-2 text-sm text-[#001433]/65">{horing.subtitle}</p>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-[#001433]/55">{BLOG_AGGREGATE_DISCLOSURE}</p>
    </aside>
  );
}
