'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { SakPreviewDialog } from '@/components/opinions/sak-preview-dialog';
import { rankSakOptions, tokenizeOpinionQuery } from '@/lib/opinions/sak-relevance';
import type { SakPickerOption } from '@/lib/opinions/types';
import { cn } from '@/lib/utils';

type SakPickerProps = {
  options: SakPickerOption[];
  value: string | null;
  onChange: (issueId: string | null) => void;
  context?: string;
  loading?: boolean;
};

export function SakPicker({ options, value, onChange, context = '', loading = false }: SakPickerProps) {
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const selected = value ? options.find((option) => option.id === value) : null;
  const previewOption = previewId ? options.find((option) => option.id === previewId) : null;
  const hasQuery = query.trim().length > 0;
  const hasTitleContext = tokenizeOpinionQuery(context).length > 0 || context.trim().length >= 5;

  const titleSuggestions = useMemo(
    () => rankSakOptions(options, context, 5),
    [options, context],
  );

  const searchResults = useMemo(
    () => rankSakOptions(options, [query.trim(), context.trim()].filter(Boolean).join(' '), 8),
    [options, query, context],
  );

  const rows = hasQuery ? searchResults : titleSuggestions;
  const listLabel = hasQuery ? 'Søketreff' : 'Forslag ut fra tittelen';
  const showList = Boolean(selected) ? false : hasQuery || hasTitleContext;

  return (
    <div data-sak-picker="" className="space-y-2">
      <div>
        <label htmlFor="sak-picker-search" className="mb-1 block text-sm font-medium text-foreground">
          Knytt til en sak
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {hasTitleContext
            ? 'Forslagene oppdateres automatisk ut fra tittelen. Åpne saken her for å sjekke at det er riktig — du mister ikke skjemaet.'
            : 'Skriv tittelen først, så foreslår vi saker. Åpne en sak for å se innholdet uten å forlate siden.'}
        </p>
      </div>

      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Valgt sak</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{selected.title}</p>
            <p className="text-xs text-muted-foreground">
              {selected.category ? `${selected.category} · ` : ''}
              {selected.henvisning ? `${selected.henvisning} · ` : ''}
              Sak {selected.id}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              data-sak-preview={selected.id}
              onClick={() => setPreviewId(selected.id)}
              className="text-xs font-medium text-brand hover:underline"
            >
              Vis sak
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQuery('');
              }}
              className="text-xs font-medium text-muted-foreground hover:underline"
            >
              Bytt sak
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="sak-picker-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk på sakstittel eller saksnummer"
              className="w-full rounded-2xl border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
            {hasQuery ? (
              <button
                type="button"
                aria-label="Tøm søk"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {showList ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-xs font-semibold text-foreground">{listLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {rows.length === 1 ? '1 sak' : `${rows.length} saker`}
                </p>
              </div>
              {loading && rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Henter saker…</p>
              ) : rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  {hasQuery
                    ? 'Ingen saker matcher søket. Prøv et annet ord eller saksnummer.'
                    : 'Ingen treff på tittelen ennå. Prøv et mer konkret søk.'}
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-border overflow-auto" role="listbox">
                  {rows.map((option, index) => (
                    <li key={option.id}>
                      <div className="flex items-stretch">
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          data-sak-option={option.id}
                          className={cn(
                            'flex min-w-0 flex-1 flex-col items-start px-3 py-2.5 text-left hover:bg-muted',
                          )}
                          onClick={() => {
                            onChange(option.id);
                            setQuery('');
                          }}
                        >
                          <span className="flex w-full items-start gap-2">
                            <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                              {option.title}
                            </span>
                            {!hasQuery && index === 0 ? (
                              <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                                Beste treff
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 text-xs text-muted-foreground">
                            {option.category ? `${option.category} · ` : ''}
                            {option.henvisning ? `${option.henvisning} · ` : ''}
                            Sak {option.id}
                          </span>
                        </button>
                        <button
                          type="button"
                          data-sak-preview={option.id}
                          onClick={() => setPreviewId(option.id)}
                          className="shrink-0 px-3 text-xs font-medium text-brand hover:underline"
                        >
                          Vis
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}

      <SakPreviewDialog
        issueId={previewId}
        title={previewOption?.title ?? selected?.title}
        onClose={() => setPreviewId(null)}
        onSelect={
          previewId && previewId !== value
            ? (id) => {
                onChange(id);
                setQuery('');
              }
            : undefined
        }
      />
    </div>
  );
}
