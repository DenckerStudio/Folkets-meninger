'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { AiSummaryReviewItem, AiSummaryReviewSource } from '@/lib/admin/ai-summary-review';
import { routes } from '@/lib/routes';

type SummariesResponse = {
  summaries?: AiSummaryReviewItem[];
  error?: string;
};

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function SummarySources({ sources, issueId }: { sources: AiSummaryReviewSource[]; issueId: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kilder</p>
      <ul className="mt-1 space-y-1.5 text-sm">
        <li>
          <Link href={routes.sak(issueId)} className="font-medium text-brand hover:underline">
            Stortingssak {issueId}
          </Link>
        </li>
        {sources.map((source) => {
          const href = source.url && isHttpUrl(source.url) ? source.url : null;
          return (
            <li key={`${source.url ?? source.title}`}>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 font-medium text-brand hover:underline"
                >
                  <span className="min-w-0 wrap-anywhere">{source.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <span className="wrap-anywhere text-foreground">{source.title}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryPreview({ item }: { item: AiSummaryReviewItem }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tittel</p>
        <h4 className="mt-1 text-base font-semibold break-words text-foreground">{item.title}</h4>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beskrivelse</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed break-words text-muted-foreground">
          {item.narrative.trim() || 'Ingen beskrivelse er lagret for dette sammendraget.'}
        </p>
      </div>
      <SummarySources sources={item.sources} issueId={item.issueId} />
      {item.labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {item.labels.map((label) => (
            <li
              key={label}
              className="max-w-full rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs break-words text-muted-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SummaryListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laster sammendrag">
      {[0, 1].map((key) => (
        <div key={key} className="h-32 animate-pulse rounded-2xl border border-border bg-muted/30" />
      ))}
    </div>
  );
}

export function AiSummaryReview() {
  const [items, setItems] = useState<AiSummaryReviewItem[]>([]);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch('/api/admin/ai-summaries');
        const json = (await res.json().catch(() => ({}))) as SummariesResponse;
        if (!res.ok) {
          setItems([]);
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke laste sammendrag');
          return;
        }
        setItems(json.summaries ?? []);
      } catch {
        setItems([]);
        setError('Kunne ikke laste sammendrag');
      } finally {
        setInitialLoad(false);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Godkjenn eller avvis sammendrag. Ved avvisning settes saken i kø for ny generering.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {initialLoad ? <SummaryListSkeleton /> : null}
      {!initialLoad && !error && items.length === 0 ? (
        <EmptyState
          title="Ingen sammendrag å vurdere"
          description="Når saker har fått et sammendrag, vises de her."
          className="py-8"
        />
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.issueId} className="rounded-2xl border border-border bg-card p-4">
            <SummaryPreview item={item} />
            {item.updatedAt ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Oppdatert {new Date(item.updatedAt).toLocaleString('nb-NO')}
              </p>
            ) : null}
            <div className="mt-4">
              {activeId === item.issueId ? (
                <ContentFeedbackPanel
                  key={item.issueId}
                  contentType="ai_summary"
                  contentId={item.issueId}
                  contentSubjectTitle={item.title}
                  title="Vurder sammendraget"
                  description="Godkjenn eller avvis sammendraget. Ved avvisning settes saken i kø for ny generering."
                  onSkip={() => setActiveId(null)}
                  onSaved={() => setActiveId(null)}
                />
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setActiveId(item.issueId)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Vurder
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
