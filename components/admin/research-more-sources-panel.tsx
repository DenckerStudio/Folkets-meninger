'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { NormalizedSourceHit } from '@/lib/sources/types';
import { cn } from '@/lib/utils';

type Scope =
  | { kind: 'topic'; topicId: string }
  | { kind: 'issue'; issueId: string };

function searchUrl(scope: Scope): string {
  return scope.kind === 'topic'
    ? `/api/admin/research/topics/${encodeURIComponent(scope.topicId)}/more-sources`
    : `/api/admin/research/issues/${encodeURIComponent(scope.issueId)}/more-sources`;
}

type HitRow = NormalizedSourceHit & { selected: boolean };

export function ResearchMoreSourcesPanel({ scope }: { scope: Scope }) {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [hits, setHits] = useState<HitRow[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [webSearchError, setWebSearchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const endpoint = searchUrl(scope);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { web_search_enabled?: boolean };
        if (!cancelled) {
          setWebSearchEnabled(body.web_search_enabled === true);
          setConfigLoaded(true);
        }
      } catch {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const runSearch = useCallback(async () => {
    setError('');
    setInfo('');
    setWebSearchError(null);
    setSearchPending(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        results?: NormalizedSourceHit[];
        web_search_error?: string | null;
      };
      if (!res.ok) {
        setError(body.message?.trim() || 'Kunne ikke hente kilder');
        setHits([]);
        return;
      }
      const rows = Array.isArray(body.results) ? body.results : [];
      setHits(rows.map((row) => ({ ...row, selected: true })));
      setWebSearchError(
        typeof body.web_search_error === 'string' ? body.web_search_error : null,
      );
      setExpanded(true);
      if (rows.length === 0) {
        setInfo('Ingen nye treff.');
      }
    } catch {
      setError('Kunne ikke hente kilder');
    } finally {
      setSearchPending(false);
    }
  }, [endpoint]);

  const saveSelected = useCallback(async () => {
    if (scope.kind !== 'topic') return;
    const selected = hits.filter((h) => h.selected);
    if (selected.length === 0) {
      setError('Velg minst én kilde');
      return;
    }
    setError('');
    setInfo('');
    setSavePending(true);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected: selected.map(({ selected: _s, ...hit }) => hit),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        added?: number;
        skipped?: number;
      };
      if (!res.ok) {
        setError(body.message?.trim() || 'Kunne ikke lagre kilder');
        return;
      }
      const added = typeof body.added === 'number' ? body.added : 0;
      const skipped = typeof body.skipped === 'number' ? body.skipped : 0;
      setInfo(
        added > 0
          ? `Lagret ${added} kilde${added === 1 ? '' : 'r'}${skipped > 0 ? ` (${skipped} hoppet over)` : ''}.`
          : 'Ingen nye kilder å lagre.',
      );
    } catch {
      setError('Kunne ikke lagre kilder');
    } finally {
      setSavePending(false);
    }
  }, [endpoint, hits, scope.kind]);

  if (!configLoaded) {
    return null;
  }

  const stortingetOnlyHint =
    !webSearchEnabled && configLoaded
      ? 'Nettsøk er ikke aktivert (WEB_SEARCH_URL). Viser kun Stortinget-dokumenter.'
      : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Finn flere kilder</h2>
          {stortingetOnlyHint ? (
            <p className="text-xs text-muted-foreground">{stortingetOnlyHint}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Søketekst bygges på server fra offentlige felt – ikke fra fritekst.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={searchPending}
          onClick={() => void runSearch()}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-11 shrink-0')}
        >
          {searchPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {searchPending ? 'Søker…' : 'Finn flere kilder'}
        </button>
      </div>

      {webSearchError ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Nettsøk: {webSearchError}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {info}
        </p>
      ) : null}

      {expanded && hits.length > 0 ? (
        <div className="mt-4 space-y-3">
          <ul className="space-y-2">
            {hits.map((hit) => (
              <li
                key={hit.url}
                className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
              >
                <label className="flex cursor-pointer items-start gap-2">
                  {scope.kind === 'topic' ? (
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0"
                      checked={hit.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHits((prev) =>
                          prev.map((row) =>
                            row.url === hit.url ? { ...row, selected: checked } : row,
                          ),
                        );
                      }}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{hit.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {hit.sourceType === 'stortinget' ? 'Stortinget' : hit.domain}
                    </span>
                    {hit.snippet ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {hit.snippet}
                      </p>
                    ) : null}
                    <a
                      href={hit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand hover:underline"
                    >
                      <span className="truncate">{hit.url}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {scope.kind === 'topic' ? (
            <button
              type="button"
              disabled={savePending}
              onClick={() => void saveSelected()}
              className={cn(buttonVariants({ size: 'sm' }), 'min-h-11')}
            >
              {savePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Lagre valgte kilder til tema
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Knytt til et tema-brief for å lagre kilder i briefen.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}