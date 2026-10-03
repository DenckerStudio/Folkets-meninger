'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Lightbulb } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import {
  isSuggestionStatus,
  suggestionStatusLabel,
  type SuggestionRecord,
  type SuggestionStatus,
} from '@/lib/suggestions/constants';

type Filter = 'all' | SuggestionStatus;

function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminForslagClient() {
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/suggestions');
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: SuggestionRecord[];
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste forslag.');
        setSuggestions([]);
        return;
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = (id: string, status: SuggestionStatus) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke oppdatere forslaget.');
        return;
      }
      load();
    });
  };

  const counts = useMemo(() => {
    const next = { all: suggestions.length, new: 0, handled: 0 };
    for (const suggestion of suggestions) {
      if (suggestion.status === 'new') next.new += 1;
      if (suggestion.status === 'handled') next.handled += 1;
    }
    return next;
  }, [suggestions]);

  const visible = suggestions.filter((suggestion) => filter === 'all' || suggestion.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lightbulb className="h-5 w-5 text-brand" aria-hidden />
          Forslag
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Innkommende forslag fra innloggede brukere. Merk dem som behandlet når de er lest.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer forslag">
        {(
          [
            { id: 'all', label: `Alle (${counts.all})` },
            { id: 'new', label: `Nye (${counts.new})` },
            { id: 'handled', label: `Behandlet (${counts.handled})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={
              filter === item.id
                ? 'rounded-lg bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand'
                : 'rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {pending ? 'Laster forslag…' : 'Ingen forslag i denne listen ennå.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((suggestion) => {
            const status = isSuggestionStatus(suggestion.status) ? suggestion.status : 'new';
            return (
              <li key={suggestion.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{suggestion.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.authorName || 'Innlogget bruker'}
                      {suggestion.createdAt ? ` · ${formatWhen(suggestion.createdAt)}` : ''}
                    </p>
                  </div>
                  <span
                    className={
                      status === 'handled'
                        ? 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
                        : 'shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand'
                    }
                  >
                    {suggestionStatusLabel(status)}
                  </span>
                </div>
                <div className="mt-3">
                  {status === 'new' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus(suggestion.id, 'handled')}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      Merk som behandlet
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStatus(suggestion.id, 'new')}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Merk som ny
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AdminBackLink />
    </div>
  );
}
