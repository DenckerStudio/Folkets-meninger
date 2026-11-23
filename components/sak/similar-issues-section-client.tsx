'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { SakSectionHeading } from '@/components/sak/sak-meta';
import type { SimilarSakListItem } from '@/lib/sak/similar-issues';
import { SIMILAR_ISSUES_ERROR_MESSAGE } from '@/lib/sak/similar-issues-load';
import { buildSimilarSakReasons, type SimilarSakFacets } from '@/lib/sak/similar-issues-labels';
import { similarIssuesShowsInToc } from '@/lib/sak/sak-oversikt-related-toc';
import { useSakOversiktRelatedTocPatch } from '@/components/sak/sak-oversikt-toc-provider';
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

export type SimilarIssuesSectionClientProps = {
  sakId: string;
  initialItems: readonly SimilarSakListItem[];
  initialStatus: 'ok' | 'error';
  current?: SimilarSakFacets | null;
};

export function SimilarIssuesSectionClient({
  sakId,
  initialItems,
  initialStatus,
  current = null,
}: SimilarIssuesSectionClientProps) {
  const setRelatedTocPatch = useSakOversiktRelatedTocPatch();
  const [items, setItems] = useState<SimilarSakListItem[]>(() => [...initialItems]);
  const [status, setStatus] = useState<'ok' | 'error'>(initialStatus);
  const [loading, setLoading] = useState(false);

  const syncToc = useCallback(
    (next: { loadStatus: 'ok' | 'error'; itemCount: number; clientLoading: boolean }) => {
      const visible = similarIssuesShowsInToc(next);
      setRelatedTocPatch({ similarShowsSection: visible });
    },
    [setRelatedTocPatch],
  );

  useEffect(() => {
    syncToc({ loadStatus: status, itemCount: items.length, clientLoading: loading });
  }, [status, items.length, loading, syncToc]);

  useEffect(() => {
    return () => setRelatedTocPatch(null);
  }, [setRelatedTocPatch]);

  async function retry() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/sak/${encodeURIComponent(sakId)}/similar`, {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        items?: SimilarSakListItem[];
      };
      if (!res.ok || json.status === 'error') {
        setStatus('error');
        return;
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setStatus('ok');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'ok' && items.length === 0 && !loading) {
    return null;
  }

  if (status === 'error' && !loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <SakSectionHeading title="Liknende saker" icon="file-text" iconClassName="w-5 h-5 text-brand" />
        <div
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4"
        >
          <p className="text-sm font-medium text-foreground">{SIMILAR_ISSUES_ERROR_MESSAGE}</p>
          <button
            type="button"
            onClick={() => void retry()}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Prøv igjen
          </button>
        </div>
      </section>
    );
  }

  if (loading && items.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <SakSectionHeading title="Liknende saker" icon="file-text" iconClassName="w-5 h-5 text-brand" />
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Henter liknende saker …
        </p>
      </section>
    );
  }

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