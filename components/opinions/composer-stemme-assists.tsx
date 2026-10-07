'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, SpellCheck } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import {
  RETTSSKRIVING_DRAFT_MIN,
  SOURCE_QUERY_MIN,
  type RettsskrivingResult,
} from '@/lib/chat/actions';
import { canUseOverlayActions, resolveChatGate, type ChatGateReason } from '@/lib/chat/overlay';
import type { SearxngHit } from '@/lib/chat/searxng';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type ComposerStemmeAssistsProps = {
  body: string;
  onApplyBody: (next: string) => void;
  title?: string;
  issueTitle?: string | null;
  className?: string;
};

type AssistTab = 'rettskriv' | 'kilder' | null;

/**
 * Stemme+ assists for the opinion writer: Rettskriv + Finn oppdaterte kilder.
 * Reuses the same APIs as the former chat panel actions.
 */
export function ComposerStemmeAssists({
  body,
  onApplyBody,
  title,
  issueTitle,
  className,
}: ComposerStemmeAssistsProps) {
  const [gate, setGate] = useState<ChatGateReason | 'loading'>('loading');
  const [tab, setTab] = useState<AssistTab>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/stemme-plus/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (res.status === 401) {
          setGate(
            resolveChatGate({ authenticated: false, hasStemmePlus: false, hasByok: false }),
          );
          return;
        }
        const json = (await res.json()) as {
          tier?: string;
          has_byok?: boolean;
        };
        if (!res.ok) {
          setGate(
            resolveChatGate({ authenticated: false, hasStemmePlus: false, hasByok: false }),
          );
          return;
        }
        setGate(
          resolveChatGate({
            authenticated: true,
            hasStemmePlus: json.tier === 'stemme_plus',
            hasByok: Boolean(json.has_byok),
          }),
        );
      } catch {
        if (!cancelled) {
          setGate(
            resolveChatGate({ authenticated: false, hasStemmePlus: false, hasByok: false }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (gate === 'loading') {
    return (
      <div
        data-composer-assists="loading"
        className={cn('rounded-2xl border border-dashed border-border px-3 py-3', className)}
      >
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Laster Stemme+-hjelp…
        </p>
      </div>
    );
  }

  if (gate === 'login' || gate === 'free') {
    return (
      <div
        data-composer-assists="gated"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-3',
          className,
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">Rettskriv og kilder med Stemme+</p>
          <p className="text-xs text-muted-foreground">
            Få rettskriving av begrunnelsen og søk etter oppdaterte kilder mens du skriver.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StemmePlusBadge size="sm" />
          <Link
            href={`${routes.minSide}?tab=stemme-plus`}
            className="inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {gate === 'login' ? 'Logg inn' : 'Se Stemme+'}
          </Link>
        </div>
      </div>
    );
  }

  const hasByok = gate === 'ready';
  const showAssists = canUseOverlayActions(gate);

  if (!showAssists) return null;

  return (
    <div
      data-composer-assists="ready"
      className={cn('space-y-3 rounded-2xl border border-border bg-muted/10 px-3 py-3', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-medium text-muted-foreground">Stemme+-hjelp</p>
        <Button
          type="button"
          size="sm"
          variant={tab === 'rettskriv' ? 'default' : 'outline'}
          data-composer-assist="rettskriv"
          aria-pressed={tab === 'rettskriv'}
          onClick={() => setTab(tab === 'rettskriv' ? null : 'rettskriv')}
        >
          <SpellCheck className="h-3.5 w-3.5" />
          Rettskriv
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'kilder' ? 'default' : 'outline'}
          data-composer-assist="kilder"
          aria-pressed={tab === 'kilder'}
          onClick={() => setTab(tab === 'kilder' ? null : 'kilder')}
        >
          <Search className="h-3.5 w-3.5" />
          Finn oppdaterte kilder
        </Button>
      </div>

      {tab === 'rettskriv' ? (
        <ComposerRettsskriving
          body={body}
          hasByok={hasByok}
          onApplyBody={onApplyBody}
        />
      ) : null}
      {tab === 'kilder' ? (
        <ComposerSourceSearch defaultQuery={(title || issueTitle || '').trim()} />
      ) : null}
    </div>
  );
}

function ComposerRettsskriving({
  body,
  hasByok,
  onApplyBody,
}: {
  body: string;
  hasByok: boolean;
  onApplyBody: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RettsskrivingResult | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/chat/rettskriving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: body, context: 'diskusjon' }),
      });
      const json = (await res.json()) as RettsskrivingResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Kunne ikke sjekke kladden.');
      }
      setResult(json);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke sjekke kladden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-composer-rettskriv="">
      <p className="text-xs text-muted-foreground">
        {hasByok
          ? 'Vi retter begrunnelsen med nøkkelen din. Teksten publiseres ikke før du trykker Publiser.'
          : 'Uten nøkkel viser vi bare instruksjonen. Vi later ikke som en modell har rettet teksten.'}
      </p>
      <Button
        type="button"
        size="sm"
        disabled={busy || body.trim().length < RETTSSKRIVING_DRAFT_MIN}
        onClick={() => void submit()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {hasByok ? 'Rett begrunnelsen' : 'Sjekk begrunnelsen'}
      </Button>
      {body.trim().length > 0 && body.trim().length < RETTSSKRIVING_DRAFT_MIN ? (
        <p className="text-xs text-muted-foreground">
          Skriv minst {RETTSSKRIVING_DRAFT_MIN} tegn i begrunnelsen først.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result?.mode === 'corrected' && result.corrected ? (
        <div
          data-rettskriving-result="corrected"
          className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
        >
          <p className="text-xs font-medium text-foreground">Rettet med nøkkelen din · ikke publisert</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{result.corrected}</p>
          {result.notes ? (
            <p className="text-xs text-muted-foreground">Merknader: {result.notes}</p>
          ) : null}
          <Button type="button" size="sm" onClick={() => onApplyBody(result.corrected!)}>
            Bruk i begrunnelsen
          </Button>
        </div>
      ) : null}
      {result?.mode === 'instruction' ? (
        <div
          data-rettskriving-result="instruction"
          className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2"
        >
          <p className="text-xs font-medium text-foreground">Ingen LLM-retting uten nøkkel · ikke publisert</p>
          <p className="text-xs text-muted-foreground">{result.instruction}</p>
        </div>
      ) : null}
    </div>
  );
}

function ComposerSourceSearch({ defaultQuery }: { defaultQuery: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [results, setResults] = useState<SearxngHit[] | null>(null);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setUnavailable(false);
    setResults(null);
    try {
      const res = await fetch('/api/chat/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json()) as {
        error?: string;
        unavailable?: boolean;
        results?: SearxngHit[];
      };
      if (!res.ok) {
        throw new Error(json.error || 'Kunne ikke søke etter kilder.');
      }
      if (json.unavailable) {
        setUnavailable(true);
        setError(json.error || 'Kunne ikke nå SearXNG akkurat nå. Kilder er midlertidig utilgjengelige.');
        setResults([]);
        return;
      }
      setResults(Array.isArray(json.results) ? json.results : []);
    } catch (submitError) {
      setUnavailable(true);
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke søke etter kilder.');
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-2"
      data-composer-kilder=""
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || query.trim().length < SOURCE_QUERY_MIN) return;
        void submit();
      }}
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Søk etter oppdaterte kilder</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søk etter oppdaterte kilder…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <Button type="submit" size="sm" disabled={busy || query.trim().length < SOURCE_QUERY_MIN}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Søk
        </Button>
      </div>
      {unavailable && error ? (
        <EmptyState
          compact
          tone="error"
          className="border-dashed px-3 py-4"
          title="Kildesøk er nede"
          description={error}
        />
      ) : null}
      {results && results.length === 0 && !unavailable ? (
        <EmptyState
          compact
          className="border-dashed px-3 py-4"
          title="Ingen kilder funnet"
          description="Søket ga ingen treff. Prøv en mer presis setning, eller sjekk igjen senere."
        />
      ) : null}
      {results && results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((hit) => (
            <li key={hit.url} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <a
                href={hit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand hover:underline"
              >
                {hit.title}
              </a>
              {hit.snippet ? <p className="mt-1 text-xs text-muted-foreground">{hit.snippet}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
