'use client';

import { Search } from 'lucide-react';
import {
  SAK_DOCUMENT_FILTER_OPTIONS,
  type SakDocumentFilterValue,
} from '@/lib/sak/documents-filter';
import { cn } from '@/lib/utils';

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
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Søk i dokumenttitler</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Søk i dokumenttitler …"
          className="min-h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sak-dokument-filter" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="sak-dokument-filter"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as SakDocumentFilterValue)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          {SAK_DOCUMENT_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs tabular-nums text-muted-foreground">{resultCount} treff</span>
      </div>
    </div>
  );
}