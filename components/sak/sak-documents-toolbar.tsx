'use client';

import { useId } from 'react';
import { Search } from 'lucide-react';
import {
  SAK_DOCUMENT_FILTER_OPTIONS,
  type SakDocumentFilterValue,
} from '@/lib/sak/documents-filter';
import { cn } from '@/lib/utils';

const FIELD_SHELL_CLASS =
  'flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand/40 focus-within:ring-offset-2 focus-within:ring-offset-background';

const FILTER_SELECT_CLASS =
  'min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function SakDocumentsToolbar({
  filter,
  query,
  onFilterChange,
  onQueryChange,
  resultCount,
  className,
}: {
  filter: SakDocumentFilterValue;
  query: string;
  onFilterChange: (value: SakDocumentFilterValue) => void;
  onQueryChange: (value: string) => void;
  resultCount: number;
  className?: string;
}) {
  const searchInputId = useId();
  const filterId = useId();

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <label htmlFor={searchInputId} className={FIELD_SHELL_CLASS}>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Søk i dokumenttitler …"
          className="min-h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-brand/40 focus-within:ring-offset-2 focus-within:ring-offset-background">
          <label htmlFor={filterId} className="text-xs font-medium text-muted-foreground">
            Type
          </label>
          <select id={filterId} value={filter} onChange={(event) => onFilterChange(event.target.value as SakDocumentFilterValue)} className={FILTER_SELECT_CLASS}>
            {SAK_DOCUMENT_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{resultCount} treff</span>
      </div>
    </div>
  );
}