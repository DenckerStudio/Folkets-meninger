'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  ABOUT_BLOG_SUGGESTION_CONSUMED_MESSAGE,
  ABOUT_BLOG_SUGGESTION_PICKED_MESSAGE,
  shouldShowAboutSuggestionsEmptyState,
} from '@/lib/admin/about-blog-panels';
import { cn } from '@/lib/utils';

export type AboutSuggestionChoice = {
  key: string;
  title: string;
  angle: string;
};

type SuggestionCard = AboutSuggestionChoice & {
  reason: string;
  sourceLabel: string;
  relatedTitle: string | null;
  relatedKind: 'utkast' | 'publisert' | null;
  evergreen: boolean;
  mentionUrl: string | null;
  interestOnly: boolean;
};

type SuggestionsPayload = {
  suggestions?: unknown;
  has_history?: boolean;
  notes?: unknown;
  message?: string;
  error?: string;
};

function parseCard(raw: unknown): SuggestionCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.key !== 'string' || typeof row.title !== 'string' || typeof row.reason !== 'string') {
    return null;
  }
  const mention = typeof row.mention_url === 'string' ? row.mention_url.trim() : '';
  const relatedKind = row.related_kind === 'utkast' || row.related_kind === 'publisert' ? row.related_kind : null;
  return {
    key: row.key,
    title: row.title,
    angle: typeof row.angle === 'string' ? row.angle : '',
    reason: row.reason,
    sourceLabel: typeof row.source_label === 'string' ? row.source_label : 'Forslag',
    relatedTitle: typeof row.related_title === 'string' && row.related_title.trim() ? row.related_title : null,
    relatedKind,
    evergreen: row.evergreen === true || row.source === 'staende',
    mentionUrl: /^https?:\/\//i.test(mention) ? mention : null,
    interestOnly: row.interest_only === true,
  };
}

function notesFrom(body: SuggestionsPayload): string[] {
  if (!Array.isArray(body.notes)) return [];
  return body.notes.filter((note): note is string => typeof note === 'string' && note.trim().length > 0);
}

export type AboutSuggestionDraftOutcome = {
  suggestionKey: string;
  ok: boolean;
};

export function AboutBlogSuggestionsPanel({
  onUse,
  draftOutcome = null,
  onDraftOutcomeHandled,
  clearUsedMessageSignal = 0,
}: {
  onUse: (suggestion: AboutSuggestionChoice) => void;
  draftOutcome?: AboutSuggestionDraftOutcome | null;
  onDraftOutcomeHandled?: () => void;
  clearUsedMessageSignal?: number;
}) {
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [hasHistory, setHasHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [tableMessage, setTableMessage] = useState('');
  const [error, setError] = useState('');
  const [usedMessage, setUsedMessage] = useState('');

  const applyPayload = useCallback((body: SuggestionsPayload) => {
    const cards = Array.isArray(body.suggestions)
      ? body.suggestions.map(parseCard).filter((card): card is SuggestionCard => card !== null)
      : [];
    setSuggestions(cards);
    setNotes(notesFrom(body));
    setHasHistory(body.has_history === true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/blog/suggestions', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as SuggestionsPayload;
      if (!res.ok) {
        setSuggestions([]);
        setHasHistory(false);
        if (body.error === 'table_missing' && typeof body.message === 'string') {
          setTableMessage(body.message);
          setError('');
        } else {
          setTableMessage('');
          setError(typeof body.message === 'string' ? body.message : 'Kunne ikke hente forslagene.');
        }
        return;
      }
      setTableMessage('');
      setError('');
      applyPayload(body);
    } catch {
      setSuggestions([]);
      setHasHistory(false);
      setTableMessage('');
      setError('Kunne ikke hente forslagene.');
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draftOutcome) return;
    if (draftOutcome.ok) {
      setSuggestions((current) => current.filter((row) => row.key !== draftOutcome.suggestionKey));
      setUsedMessage(ABOUT_BLOG_SUGGESTION_CONSUMED_MESSAGE);
      void load();
    } else {
      setUsedMessage('');
    }
    onDraftOutcomeHandled?.();
  }, [draftOutcome, load, onDraftOutcomeHandled]);

  useEffect(() => {
    if (clearUsedMessageSignal === 0) return;
    setUsedMessage('');
  }, [clearUsedMessageSignal]);

  const refresh = async () => {
    if (refreshing || pendingKey) return;
    setRefreshing(true);
    setError('');
    setUsedMessage('');
    try {
      const res = await fetch('/api/admin/blog/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      const body = (await res.json().catch(() => ({}))) as SuggestionsPayload;
      if (!res.ok) {
        if (body.error === 'table_missing' && typeof body.message === 'string') {
          setTableMessage(body.message);
        } else {
          setError(typeof body.message === 'string' ? body.message : 'Kunne ikke oppdatere forslagene.');
        }
        return;
      }
      setTableMessage('');
      applyPayload(body);
    } catch {
      setError('Kunne ikke oppdatere forslagene.');
    } finally {
      setRefreshing(false);
    }
  };

  const pick = (item: SuggestionCard) => {
    if (busy) return;
    onUse({ key: item.key, title: item.title, angle: item.angle });
    setUsedMessage(ABOUT_BLOG_SUGGESTION_PICKED_MESSAGE);
    setError('');
  };

  const act = async (action: 'dismiss' | 'snooze', item: SuggestionCard) => {
    if (pendingKey || refreshing) return;
    setPendingKey(item.key);
    setError('');
    setUsedMessage('');
    try {
      const res = await fetch('/api/admin/blog/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, suggestion_key: item.key }),
      });
      const body = (await res.json().catch(() => ({}))) as SuggestionsPayload;
      if (!res.ok) {
        if (body.error === 'table_missing' && typeof body.message === 'string') {
          setTableMessage(body.message);
        } else {
          setError(typeof body.message === 'string' ? body.message : 'Kunne ikke lagre valget.');
        }
        return;
      }
      setSuggestions((current) => current.filter((row) => row.key !== item.key));
    } catch {
      setError('Kunne ikke lagre valget.');
    } finally {
      setPendingKey(null);
    }
  };

  const busy = refreshing || pendingKey !== null;
  const showEmpty = shouldShowAboutSuggestionsEmptyState({
    loading,
    hasError: Boolean(error),
    tableMessage: Boolean(tableMessage),
    suggestionCount: suggestions.length,
  });

  return (
    <section className="space-y-4" aria-labelledby="about-blog-suggestions-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="about-blog-suggestions-heading" className="text-base font-semibold text-foreground">
            Foreslåtte innlegg
          </h3>
          <p className="text-sm text-muted-foreground">
            Vinkler til innlegg om tjenesten. Ingenting publiseres automatisk. Avvis fjerner
            forslaget. Utsett skjuler det i 14 dager.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy || Boolean(tableMessage)}
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 gap-1.5 px-3')}
        >
          {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Oppdater forslag
        </button>
      </div>

      {tableMessage ? (
        <p
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="alert"
        >
          {tableMessage}
        </p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'min-h-11 shrink-0 border-destructive/30 bg-background px-3 text-destructive',
            )}
          >
            Prøv igjen
          </button>
        </div>
      ) : null}
      {usedMessage ? (
        <p className="text-sm text-foreground" role="status">
          {usedMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Laster forslag">
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : null}

      {showEmpty ? (
        <p className="text-sm text-muted-foreground">
          {hasHistory
            ? 'Ingen åpne forslag. Avviste blir liggende, og utsatte kommer ikke tilbake før fristen er ute og du oppdaterer.'
            : 'Ingen forslag er hentet ennå. Oppdater for å lage en liste fra det vi allerede vet om tjenesten.'}
        </p>
      ) : null}

      {!loading && suggestions.length > 0 ? (
        <ul className="space-y-3">
          {suggestions.map((item) => (
            <li key={item.key}>
              <article className="space-y-3 rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-brand">
                  {item.evergreen ? 'Stående forslag' : item.sourceLabel}
                </p>
                <h4 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.reason}</p>
                {item.relatedTitle ? (
                  <p className="text-sm text-foreground">
                    Sist lignende: {item.relatedTitle}
                    {item.relatedKind === 'utkast' ? ' (utkast)' : ''}
                  </p>
                ) : null}
                {item.interestOnly ? (
                  <p className="text-xs text-muted-foreground">Interessesignal, ikke en kilde.</p>
                ) : null}
                {item.mentionUrl ? (
                  <a
                    href={item.mentionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {item.interestOnly ? 'Åpne diskusjonen' : 'Åpne omtalen'}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => pick(item)}
                    className={cn(buttonVariants({ variant: 'default' }), 'min-h-11 px-3')}
                  >
                    Bruk forslaget
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('dismiss', item)}
                    className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 px-3')}
                  >
                    Avvis
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('snooze', item)}
                    className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 px-3')}
                  >
                    Utsett
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
