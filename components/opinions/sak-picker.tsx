'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
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

  const selected = value ? options.find((option) => option.id === value) : null;
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
        <label htmlFor="sak-picker-search" className="mb-1 block text-sm font-medium text-[#001433]">
          Knytt til en sak
        </label>
        <p className="text-xs leading-relaxed text-[#001433]/60">
          {hasTitleContext
            ? 'Forslagene oppdateres automatisk ut fra tittelen. Søk om du vil velge en annen sak.'
            : 'Skriv tittelen først, så foreslår vi saker. Du kan også søke på tittel eller saksnummer.'}
        </p>
      </div>

      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#00205b]/15 bg-white/90 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00205b]/70">Valgt sak</p>
            <p className="mt-0.5 truncate text-sm font-medium text-[#001433]">{selected.title}</p>
            <p className="text-xs text-[#001433]/60">
              {selected.category ? `${selected.category} · ` : ''}
              {selected.henvisning ? `${selected.henvisning} · ` : ''}
              Sak {selected.id}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            className="shrink-0 text-xs font-medium text-[#00205b] hover:underline"
          >
            Bytt sak
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#001433]/40" />
            <input
              id="sak-picker-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk på sakstittel eller saksnummer"
              className="w-full rounded-2xl border border-[#00205b]/15 bg-white/90 py-2.5 pl-9 pr-10 text-sm text-[#001433] outline-none placeholder:text-[#001433]/40 focus:ring-2 focus:ring-[#00205b]/25"
            />
            {hasQuery ? (
              <button
                type="button"
                aria-label="Tøm søk"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#001433]/40 hover:text-[#001433]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {showList ? (
            <div className="overflow-hidden rounded-2xl border border-[#00205b]/12 bg-white/90">
              <div className="flex items-center justify-between border-b border-[#00205b]/8 px-3 py-2">
                <p className="text-xs font-semibold text-[#001433]">{listLabel}</p>
                <p className="text-xs text-[#001433]/50">
                  {rows.length === 1 ? '1 sak' : `${rows.length} saker`}
                </p>
              </div>
              {loading && rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#001433]/55">Henter saker…</p>
              ) : rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#001433]/55">
                  {hasQuery
                    ? 'Ingen saker matcher søket. Prøv et annet ord eller saksnummer.'
                    : 'Ingen treff på tittelen ennå. Prøv et mer konkret søk.'}
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-[#00205b]/8 overflow-auto" role="listbox">
                  {rows.map((option, index) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        data-sak-option={option.id}
                        className={cn(
                          'flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-[#00205b]/5',
                        )}
                        onClick={() => {
                          onChange(option.id);
                          setQuery('');
                        }}
                      >
                        <span className="flex w-full items-start gap-2">
                          <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-[#001433]">
                            {option.title}
                          </span>
                          {!hasQuery && index === 0 ? (
                            <span className="shrink-0 rounded-full bg-[#00205b]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#00205b]">
                              Beste treff
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 text-xs text-[#001433]/55">
                          {option.category ? `${option.category} · ` : ''}
                          {option.henvisning ? `${option.henvisning} · ` : ''}
                          Sak {option.id}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
