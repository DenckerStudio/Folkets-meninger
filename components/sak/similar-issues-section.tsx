import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SakSectionHeading } from '@/components/sak/sak-meta';
import {
  fetchSimilarSaker,
  shouldShowSimilarSakerSection,
  type SimilarSakListItem,
} from '@/lib/sak/similar-issues';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

function SimilarSakRow({ item }: { item: SimilarSakListItem }) {
  const meta = [item.sesjon, item.statusLabel].filter(Boolean).join(' · ');

  return (
    <Link
      href={routes.sak(item.id)}
      className="group flex min-h-11 items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 transition-colors hover:border-brand/30 hover:bg-muted"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-brand">{item.title}</div>
        {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      <ArrowRight
        className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand')}
        aria-hidden
      />
    </Link>
  );
}

export async function SimilarIssuesSection({ sakId }: { sakId: string }) {
  let items: SimilarSakListItem[] = [];
  try {
    items = await fetchSimilarSaker(sakId);
  } catch {
    items = [];
  }

  if (!shouldShowSimilarSakerSection(items)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <SakSectionHeading title="Liknende saker" icon="file-text" iconClassName="w-5 h-5 text-brand" />
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <SimilarSakRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}