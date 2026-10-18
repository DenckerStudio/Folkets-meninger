'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { actionClusterStatusLabel, actionTypeLabel } from '@/lib/actions/labels';
import type { ActionClusterRecord, ActionClusterStatus, ActionSourceRecord } from '@/lib/actions/types';
import { routes } from '@/lib/routes';
import { AdminBackLink } from '@/components/admin/admin-shell';

const FILTER_STATUSES: { value: ActionClusterStatus | 'all'; label: string }[] = [
  { value: 'would_draft', label: 'Klar for utkast' },
  { value: 'manual_only', label: 'Kun manuelt' },
  { value: 'drafted', label: 'Utkast laget' },
  { value: 'blocked', label: 'Blokkert' },
  { value: 'below_threshold', label: 'Under terskel' },
  { value: 'rejected', label: 'Avvist' },
  { value: 'all', label: 'Alle' },
];

type Props = {
  initialClusters: ActionClusterRecord[];
};

export default function AdminAksjonerClient({ initialClusters }: Props) {
  const [clusters, setClusters] = useState(initialClusters);
  const [statusFilter, setStatusFilter] = useState<ActionClusterStatus | 'all'>('would_draft');
  const [selectedId, setSelectedId] = useState<string | null>(initialClusters[0]?.id ?? null);
  const [sources, setSources] = useState<ActionSourceRecord[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => clusters.find((c) => c.id === selectedId) ?? null,
    [clusters, selectedId],
  );

  const loadList = useCallback((status: ActionClusterStatus | 'all') => {
    startTransition(async () => {
      setError('');
      const res = await fetch(`/api/admin/actions?status=${encodeURIComponent(status)}`);
      if (!res.ok) {
        setError('Kunne ikke laste klynger');
        return;
      }
      const json = (await res.json()) as { clusters: ActionClusterRecord[] };
      setClusters(json.clusters ?? []);
    });
  }, []);

  const loadDetail = useCallback((clusterId: string) => {
    setSelectedId(clusterId);
    startTransition(async () => {
      setError('');
      const res = await fetch(`/api/admin/actions?clusterId=${encodeURIComponent(clusterId)}`);
      if (!res.ok) {
        setError('Kunne ikke laste detaljer');
        return;
      }
      const json = (await res.json()) as { cluster: ActionClusterRecord; sources: ActionSourceRecord[] };
      setSources(json.sources ?? []);
      if (json.cluster) {
        setClusters((prev) => {
          const idx = prev.findIndex((c) => c.id === json.cluster.id);
          if (idx < 0) return [...prev, json.cluster];
          const next = [...prev];
          next[idx] = json.cluster;
          return next;
        });
      }
    });
  }, []);

  const patch = (body: Record<string, unknown>) => {
    if (!selectedId) return;
    startTransition(async () => {
      setError('');
      setMessage('');
      const res = await fetch('/api/admin/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId: selectedId, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Handling feilet');
        return;
      }
      setMessage('Lagret');
      if (json.cluster) {
        setClusters((prev) => prev.map((c) => (c.id === json.cluster.id ? json.cluster : c)));
      }
      if (json.sources) setSources(json.sources);
      loadList(statusFilter);
    });
  };

  const bestScale = selected?.bestScale as { value?: number; unit?: string; source_url?: string; as_of?: string } | null;

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Aksjoner</h1>
        <p className="text-sm text-muted-foreground">
          Automatisk oppdagede aksjoner. Publiser utkast, rediger tekst eller avvis klynger.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTER_STATUSES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setStatusFilter(item.value);
              loadList(item.value);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === item.value
                ? 'bg-brand/15 text-brand'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
        {pending ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen klynger i dette filteret.</p>
          ) : (
            clusters.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                onClick={() => loadDetail(cluster.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedId === cluster.id
                    ? 'border-brand/50 bg-brand/5'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <p className="font-medium text-foreground">{cluster.actionName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actionTypeLabel(cluster.actionType)} · {actionClusterStatusLabel(cluster.status)}
                  {cluster.sensitiveCategory ? ' · Sensitiv' : ''}
                </p>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{selected.actionName}</h2>
              <p className="text-sm text-muted-foreground">{selected.descriptionNb}</p>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{actionClusterStatusLabel(selected.status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Nasjonal dekning</dt>
                <dd className="font-medium">{selected.nationalCoverage ? 'Ja' : 'Nei'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Utgivere</dt>
                <dd className="font-medium">{selected.independentPublishers.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Confidence</dt>
                <dd className="font-medium">{selected.maxConfidence ?? '—'}</dd>
              </div>
              {bestScale?.value != null ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Skala (ifølge kilde)</dt>
                  <dd className="font-medium">
                    ca. {bestScale.value} {bestScale.unit}
                    {bestScale.as_of ? ` (${bestScale.as_of})` : ''}
                  </dd>
                </div>
              ) : null}
              {selected.relatedIssueId ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Relatert sak (kun admin)</dt>
                  <dd>
                    <Link href={routes.sak(selected.relatedIssueId)} className="text-brand hover:underline">
                      {selected.relatedIssueId}
                      {selected.relatedSimilarity != null
                        ? ` · likhet ${selected.relatedSimilarity.toFixed(2)}`
                        : ''}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            {selected.pollId ? (
              <p className="text-sm">
                Utkast:{' '}
                <Link href={routes.poll(selected.pollId)} className="font-medium text-brand hover:underline">
                  {selected.pollId}
                </Link>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selected.pollId ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patch({ action: 'publish', pollId: selected.pollId })}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  Publiser utkast
                </button>
              ) : null}
              {selected.status === 'manual_only' && !selected.pollId ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    patch({
                      action: 'manual_draft',
                      title: `Støtter du ${selected.actionName}?`,
                      neutralSummary: selected.descriptionNb,
                      sourceUrl: sources[0]?.urlCanonical ?? '',
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Lag utkast manuelt
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => patch({ action: 'reject', reason: 'Avvist i admin' })}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Avvis
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => patch({ action: 'not_action' })}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Ikke en aksjon
              </button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Kilder</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {sources.length === 0 ? (
                  <li className="text-muted-foreground">Ingen kilder lastet.</li>
                ) : (
                  sources.map((source) => (
                    <li key={source.id} className="rounded-lg border border-border px-3 py-2">
                      <a
                        href={source.urlCanonical}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand hover:underline"
                      >
                        {source.title ?? source.urlCanonical}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {source.publisher ?? 'Ukjent utgiver'}
                        {source.signalOnly ? ' · kun signal' : ''}
                      </p>
                      {source.excerpt ? (
                        <p className="mt-1 text-xs text-muted-foreground">{source.excerpt}</p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
