'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import {
  RETTSSKRIVING_DRAFT_MAX,
  RETTSSKRIVING_DRAFT_MIN,
  SOURCE_QUERY_MIN,
  SPELLING_CONTEXTS,
  spellingContextLabel,
  type RettsskrivingResult,
  type SpellingContext,
} from '@/lib/chat/actions';
import type { SearxngHit } from '@/lib/chat/searxng';
import { cn } from '@/lib/utils';

type PanelAction = 'rettskriving' | 'kilder';

type ChatPanelActionsProps = {
  issueTitle?: string | null;
  compact?: boolean;
  hasByok?: boolean;
};

function actionLabel(action: PanelAction): string {
  switch (action) {
    case 'rettskriving':
      return 'Rettskriving';
    case 'kilder':
      return 'Finn oppdaterte kilder';
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

export function ChatPanelActions({
  issueTitle,
  compact = false,
  hasByok = false,
}: ChatPanelActionsProps) {
  const [action, setAction] = useState<PanelAction>('rettskriving');

  return (
    <div
      data-chat-actions=""
      className={cn('shrink-0 border-b border-border', compact ? 'px-4 py-3' : 'px-4 py-4')}
    >
      <div className="flex flex-wrap gap-2">
        {(['rettskriving', 'kilder'] as const).map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={action === id ? 'default' : 'outline'}
            data-chat-action={id}
            aria-pressed={action === id}
            onClick={() => setAction(id)}
          >
            {actionLabel(id)}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Direkte handlinger — uten å starte en AI-samtale. Kladden publiseres ikke.
      </p>
      {action === 'rettskriving' ? (
        <RettsskrivingForm hasByok={hasByok} />
      ) : (
        <SourceSearchForm issueTitle={issueTitle} />
      )}
    </div>
  );
}

function RettsskrivingForm({ hasByok }: { hasByok: boolean }) {
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState<SpellingContext>('annet');
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
        body: JSON.stringify({ draft, context }),
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
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || draft.trim().length < RETTSSKRIVING_DRAFT_MIN) return;
        void submit();
      }}
    >
      <p className="text-xs text-muted-foreground">
        {hasByok
          ? 'Vi retter kladden med nøkkelen din. Kladden publiseres ikke.'
          : 'Uten nøkkel viser vi bare instruksjonen. Vi later ikke som en modell har rettet teksten.'}
      </p>
      <label className="block">
        <span className="sr-only">Kladd til rettskriving</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          maxLength={RETTSSKRIVING_DRAFT_MAX}
          placeholder="Lim inn eller skriv en kladd. Vi publiserer den ikke."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Brukes som</span>
          <select
            value={context}
            onChange={(event) => setContext(event.target.value as SpellingContext)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {SPELLING_CONTEXTS.map((value) => (
              <option key={value} value={value}>
                {spellingContextLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" disabled={busy || draft.trim().length < RETTSSKRIVING_DRAFT_MIN}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {hasByok ? 'Rett kladden' : 'Sjekk kladden'}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? <RettsskrivingResultView result={result} /> : null}
    </form>
  );
}

function RettsskrivingResultView({ result }: { result: RettsskrivingResult }) {
  switch (result.mode) {
    case 'corrected':
      return (
        <div
          data-rettskriving-result="corrected"
          className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
        >
          <p className="text-xs font-medium text-foreground">
            Rettet med nøkkelen din · ikke publisert · {spellingContextLabel(result.context)}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{result.corrected}</p>
          {result.notes ? (
            <p className="text-xs text-muted-foreground">Merknader: {result.notes}</p>
          ) : null}
        </div>
      );
    case 'instruction':
      return (
        <div
          data-rettskriving-result="instruction"
          className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2"
        >
          <p className="text-xs font-medium text-foreground">
            Ingen LLM-retting uten nøkkel · ikke publisert · {spellingContextLabel(result.context)}
          </p>
          <p className="text-xs text-muted-foreground">{result.instruction}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{result.original}</p>
        </div>
      );
    default: {
      const _never: never = result;
      void _never;
      return null;
    }
  }
}

function SourceSearchForm({ issueTitle }: { issueTitle?: string | null }) {
  const [query, setQuery] = useState(issueTitle?.trim() || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [results, setResults] = useState<SearxngHit[] | null>(null);

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
      className="mt-3 space-y-2"
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
