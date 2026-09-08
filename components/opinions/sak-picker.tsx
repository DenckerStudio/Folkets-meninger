'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { rankSakOptions, tokenizeOpinionQuery } from '@/lib/opinions/sak-relevance';
import type { SakPickerOption } from '@/lib/opinions/types';
import { cn } from '@/lib/utils';

type SakPickerProps = {
  options: SakPickerOption[];
  value: string | null;
  onChange: (issueId: string | null) => void;
  context?: string;
};

export function SakPicker({ options, value, onChange, context = '' }: SakPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = value ? options.find((option) => option.id === value) : null;
  const searchText = query.trim() || context;
  const hasContext = tokenizeOpinionQuery(context).length > 0 || context.trim().length >= 5;

  const filtered = useMemo(
    () => rankSakOptions(options, searchText, 8),
    [options, searchText],
  );

  const suggestions = useMemo(
    () => (query.trim() ? [] : rankSakOptions(options, context, 4)),
    [options, context, query],
  );

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-medium text-[#001433]">
        Knytt til en sak fra Utforsk
      </label>
      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#00205b]/15 bg-white/80 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#001433]">{selected.title}</p>
            <p className="text-xs text-[#001433]/60">
              {selected.category ? `${selected.category} · ` : ''}Sak {selected.id}
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
            Fjern
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs leading-relaxed text-[#001433]/60">
            {hasContext
              ? 'Forslagene under følger tittelen din. Søk videre om du vil finne en annen sak.'
              : 'Skriv tittelen først, så foreslår vi saker som matcher det du skriver om.'}
          </p>
          {suggestions.length > 0 && hasContext ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="max-w-full truncate rounded-full bg-[#00205b]/8 px-2.5 py-1 text-xs font-medium text-[#00205b] hover:bg-[#00205b]/12"
                >
                  {option.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#001433]/40" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 150);
              }}
              placeholder={hasContext ? 'Søk videre i saker' : 'Søk etter sakstittel eller saksnummer'}
              className="w-full rounded-2xl border border-[#00205b]/15 bg-white/90 py-2.5 pl-9 pr-3 text-sm text-[#001433] outline-none placeholder:text-[#001433]/40 focus:ring-2 focus:ring-[#00205b]/25"
            />
          </div>
          {open && filtered.length > 0 ? (
            <ul
              className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-border bg-card py-1 shadow-lg"
              role="listbox"
            >
              {filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option.id}
                    className={cn('flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-foreground">{option.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.category ? `${option.category} · ` : ''}
                      {option.henvisning ? `${option.henvisning} · ` : ''}
                      Sak {option.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
