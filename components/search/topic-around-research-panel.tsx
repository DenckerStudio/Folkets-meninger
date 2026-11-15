'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { TopicAroundHitList } from '@/components/search/topic-around-hit-list';
import { buttonVariants } from '@/components/ui/button';
import {
  TOPIC_AROUND_KIND_OPTIONS,
  TOPIC_AROUND_PERIODS,
  TOPIC_AROUND_SORTS,
  type TopicAroundPeriod,
  type TopicAroundSort,
} from '@/lib/search/topic-around-filters';
import type { TopicAroundSearchItem, TopicAroundSearchResult } from '@/lib/search/topic-around-search';
import type { SakDocumentKind } from '@/lib/stortinget-documents';
import { cn } from '@/lib/utils';

const PERIOD_LABELS: Record<TopicAroundPeriod, string> = {
  all: 'Hele perioden',
  '12m': 'Siste 12 måneder',
  '24m': 'Siste 24 måneder',
  '48m': 'Siste 48 måneder',
};

const SORT_LABELS: Record<TopicAroundSort, string> = {
  relevance: 'Relevans',
  date: 'Dato',
};

type PanelProps =
  | { clusterId: string; topicId?: undefined }
  | { topicId: string; clusterId?: undefined };

type LoadState =
  | { status: 'loading' }
  | { status: 'disabled' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: TopicAroundSearchItem[]; emptyReason?: string };

export function TopicAroundResearchPanel(props: PanelProps) {
  const [period, setPeriod] = useState<TopicAroundPeriod>('all');
  const [sort, setSort] = useState<TopicAroundSort>('relevance');
  const [kinds, setKinds] = useState<SakDocumentKind[]>([]);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const queryKey = useMemo(() => {
    const params = new URLSearchParams();
    if ('clusterId' in props && props.clusterId) params.set('clusterId', props.clusterId);
    if ('topicId' in props && props.topicId) params.set('topicId', props.topicId);
    params.set('period', period);
    params.set('sort', sort);
    if (kinds.length > 0) params.set('kinds', kinds.join(','));
    return params.toString();
  }, [props, period, sort, kinds]);

  const requestGenRef = useRef(0);

  const load = useCallback(async () => {
    const requestGen = requestGenRef.current + 1;
    requestGenRef.current = requestGen;
    setState({ status: 'loading' });
    try {
      const response = await fetch(`/api/admin/research/topic-around?${queryKey}`, {
        cache: 'no-store',
      });
      if (requestGen !== requestGenRef.current) return;
      if (!response.ok) {
        setState({
          status: 'error',
          message: 'Kunne ikke hente treff. Prøv igjen om litt.',
        });
        return;
      }
      const body = (await response.json()) as TopicAroundSearchResult & {
        reason?: string;
      };
      if (requestGen !== requestGenRef.current) return;
      if (!body.ok && body.reason === 'disabled') {
        setState({ status: 'disabled' });
        return;
      }
      if (!body.ok) {
        setState({
          status: 'error',
          message:
            body.reason === 'embedding_unavailable'
              ? 'Embedding-tjenesten svarer ikke. Prøv igjen om litt.'
              : body.reason === 'timeout'
                ? 'Søket tok for lang tid. Prøv igjen.'
                : 'Søket feilet. Prøv igjen.',
        });
        return;
      }
      if (body.items.length === 0) {
        setState({
          status: 'ready',
          items: [],
          emptyReason: 'empty',
        });
        return;
      }
      setState({ status: 'ready', items: body.items });
    } catch {
      if (requestGen !== requestGenRef.current) return;
      setState({
        status: 'error',
        message: 'Nettverksfeil. Prøv igjen.',
      });
    }
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void load();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  const toggleKind = (kind: SakDocumentKind) => {
    setKinds((prev) =>
      prev.includes(kind) ? prev.filter((value) => value !== kind) : [...prev, kind],
    );
  };

  if (state.status === 'disabled') {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="topic-around-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="topic-around-heading" className="text-base font-semibold text-foreground">
            Søk rundt temaet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Relaterte Stortinget-saker og dokumentutdrag fra hybrid søk.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex min-h-11 flex-col gap-1 text-xs text-muted-foreground">
          Periode
          <select
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            value={period}
            onChange={(event) => setPeriod(event.target.value as TopicAroundPeriod)}
          >
            {TOPIC_AROUND_PERIODS.map((value) => (
              <option key={value} value={value}>
                {PERIOD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 flex-col gap-1 text-xs text-muted-foreground">
          Sortering
          <select
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            value={sort}
            onChange={(event) => setSort(event.target.value as TopicAroundSort)}
          >
            {TOPIC_AROUND_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted-foreground">Kildetype</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPIC_AROUND_KIND_OPTIONS.map((option) => {
            const active = kinds.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors',
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
                aria-pressed={active}
                onClick={() => toggleKind(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        {state.status === 'loading' ? (
          <p
            role="status"
            aria-live="polite"
            className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Søker i Stortinget-dokumenter …
          </p>
        ) : null}

        {state.status === 'error' ? (
          <EmptyState
            compact
            tone="error"
            title="Søket feilet"
            description={state.message}
            action={
              <button type="button" className={buttonVariants()} onClick={() => void load()}>
                Prøv igjen
              </button>
            }
          />
        ) : null}

        {state.status === 'ready' && state.items.length === 0 ? (
          <EmptyState
            compact
            title="Ingen treff"
            description="Utvid tidsperioden, fjern kildetype-filter eller vent til flere dokumenter er indeksert."
            action={
              <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => void load()}>
                Prøv igjen
              </button>
            }
          />
        ) : null}

        {state.status === 'ready' && state.items.length > 0 ? (
          <TopicAroundHitList items={state.items} />
        ) : null}
      </div>
    </section>
  );
}