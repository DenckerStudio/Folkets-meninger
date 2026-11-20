import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SakSectionHeading } from '@/components/sak/sak-meta';
import {
  fetchSimilarSaker,
  shouldShowSimilarSakerSection,
  type SimilarSakListItem,
} from '@/lib/sak/similar-issues';
import { dedupeSimilarSaker } from '@/lib/sak/similar-issues-dedupe';
import { buildSimilarSakReasons, type SimilarSakFacets } from '@/lib/sak/similar-issues-labels';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

function SimilarSakRow({
  item,
  current,
}: {
  item: SimilarSakListItem;
  current: SimilarSakFacets | null;
}) {
  const meta = [item.sesjon, item.statusLabel].filter(Boolean).join(' · ');
  const reasons = buildSimilarSakReasons(current, item.facets);

  return (
    <Link
      href={routes.sak(item.id)}
      className="group flex min-h-11 items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 transition-colors hover:border-brand/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <div className="min-w-0">
        <div className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere] group-hover:text-brand">
          {item.title}
        </div>
        {meta ? <div className="mt-1 text-xs font-medium text-foreground/80">{meta}</div> : null}
        {reasons.length > 0 ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{reasons.join(' · ')}</div>
        ) : null}
      </div>
      <ArrowRight
        className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand')}
        aria-hidden
      />
    </Link>
  );
}

export function SimilarSakList({
  items,
  current = null,
}: {
  items: readonly SimilarSakListItem[];
  current?: SimilarSakFacets | null;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <SakSectionHeading title="Liknende saker" icon="file-text" iconClassName="w-5 h-5 text-brand" />
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <SimilarSakRow item={item} current={current} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function SimilarIssuesSection({
  sakId,
  excludeIssueIds = [],
  current = null,
}: {
  sakId: string;
  excludeIssueIds?: readonly string[];
  current?: SimilarSakFacets | null;
}) {
  let items: SimilarSakListItem[] = [];
  try {
    items = await fetchSimilarSaker(sakId);
    items = dedupeSimilarSaker(items, sakId, excludeIssueIds);
  } catch {
    items = [];
  }

  if (!shouldShowSimilarSakerSection(items)) {
    return null;
  }

  return <SimilarSakList items={items} current={current} />;
}
