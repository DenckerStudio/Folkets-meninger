'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { ReuiComboboxSearch, ReuiComboboxTrigger } from '@/components/ui/reui-combobox';
import { SakPreviewDialog } from '@/components/opinions/sak-preview-dialog';
import { SakProcessingBadge } from '@/components/sak/sak-meta';
import {
  buildSakPickerResultList,
  SAK_PICKER_BROWSE_PAGE_SIZE,
  topSakPickerCategories,
  type SakPickerStatusFilter,
} from '@/lib/opinions/sak-relevance';
import type { SakPickerOption } from '@/lib/opinions/types';
import { useIsBelowLg } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

type SakPickerProps = {
  options: SakPickerOption[];
  value: string | null;
  onChange: (issueId: string | null) => void;
  context?: string;
  loading?: boolean;
};

const STATUS_FILTERS: { id: SakPickerStatusFilter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'pending', label: 'Under behandling' },
  { id: 'closed', label: 'Ferdigbehandlet' },
];

export function SakPicker({ options, value, onChange, context = '', loading = false }: SakPickerProps) {
  const isCompact = useIsBelowLg();
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** null = auto (pending when available, else all). */
  const [statusFilter, setStatusFilter] = useState<SakPickerStatusFilter | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(SAK_PICKER_BROWSE_PAGE_SIZE);
  /** When true, show the browse UI without clearing the current selection/stance. */
  const [browsing, setBrowsing] = useState(false);
  /** Compact (mobile/tablet): browse UI lives in a dialog instead of inline. */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rawActiveIndex, setRawActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = 'sak-picker-listbox';
  const optionId = (index: number) => `${listId}-option-${index}`;

  const selected = value ? options.find((option) => option.id === value) : null;
  const previewOption = previewId ? options.find((option) => option.id === previewId) : null;
  const hasQuery = query.trim().length > 0;

  const pendingCount = useMemo(
    () => options.filter((option) => option.status === 'pending').length,
    [options],
  );
  /** Auto-default only; explicit chip clicks must keep their filter (incl. empty pending). */
  const autoStatus: SakPickerStatusFilter = pendingCount > 0 ? 'pending' : 'all';
  const resolvedStatusFilter: SakPickerStatusFilter = statusFilter ?? autoStatus;

  const categories = useMemo(() => topSakPickerCategories(options, 12), [options]);

  const result = useMemo(
    () =>
      buildSakPickerResultList({
        options,
        searchQuery: query,
        titleContext: context,
        statusFilter: hasQuery ? 'all' : resolvedStatusFilter,
        categoryFilter: hasQuery ? categoryFilter : categoryFilter,
        visibleCount,
      }),
    [options, query, context, resolvedStatusFilter, categoryFilter, visibleCount, hasQuery],
  );

  const { rows, listLabel, totalMatching, hasMore, suggestionIds } = result;

  const maxIndex = Math.max(0, rows.length - 1);
  const activeIndex = Math.min(rawActiveIndex, maxIndex);

  useEffect(() => {
    if (!rows.length) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, rows.length]);

  function resetFilters() {
    setQuery('');
    setCategoryFilter(null);
    setStatusFilter(null);
    setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
    setRawActiveIndex(0);
  }

  function selectRow(option: SakPickerOption) {
    onChange(option.id);
    setBrowsing(false);
    setDrawerOpen(false);
    resetFilters();
  }

  function openBrowse() {
    setBrowsing(true);
    if (isCompact) setDrawerOpen(true);
  }

  function onComboboxKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setRawActiveIndex(Math.min(activeIndex + 1, maxIndex));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setRawActiveIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setRawActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setRawActiveIndex(maxIndex);
    } else if (event.key === 'Enter') {
      const row = rows[activeIndex];
      if (row) {
        event.preventDefault();
        selectRow(row);
      }
    }
  }

  const browseActive = selected ? browsing : true;

  const browseBody = (
    <>
      {selected && browsing ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-brand-soft/30 px-3 py-2 sm:px-4">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Nåværende: <span className="font-medium text-foreground">{selected.title}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setBrowsing(false);
              setDrawerOpen(false);
            }}
            className="shrink-0 text-xs font-semibold text-brand hover:underline"
          >
            Avbryt
          </button>
        </div>
      ) : null}

      <div className="space-y-3 border-b border-border bg-card/60 px-3 py-3 sm:px-4">
        <ReuiComboboxSearch
          id="sak-picker-search"
          value={query}
          listId={listId}
          activeDescendant={rows.length ? optionId(activeIndex) : undefined}
          onKeyDown={onComboboxKeyDown}
          placeholder="Søk på sakstittel, tema eller saksnummer…"
          onChange={(next) => {
            setQuery(next);
            setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
            setRawActiveIndex(0);
          }}
        />
        {hasQuery ? (
          <button
            type="button"
            aria-label="Tøm søk"
            onClick={() => {
              setQuery('');
              setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
            }}
            className="-mt-1 text-xs font-medium text-brand hover:underline"
          >
            Tøm søk
          </button>
        ) : null}

        {!hasQuery ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer på behandlingsstatus">
            {STATUS_FILTERS.map((filter) => {
              const active = resolvedStatusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  data-sak-status-filter={filter.id}
                  aria-pressed={active}
                  onClick={() => {
                    setStatusFilter(filter.id);
                    setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
                    setRawActiveIndex(0);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Søk viser treff i hele katalogen. Fjern søket for å bruke statusfiltrene igjen.
          </p>
        )}

        {categories.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-pressed={categoryFilter === null}
              onClick={() => {
                setCategoryFilter(null);
                setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
                setRawActiveIndex(0);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                categoryFilter === null
                  ? 'border-brand/40 bg-brand-soft text-brand'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              Alle tema
            </button>
            {categories.map((category) => {
              const active = categoryFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  data-sak-category-filter={category}
                  aria-pressed={active}
                  onClick={() => {
                    setCategoryFilter(active ? null : category);
                    setVisibleCount(SAK_PICKER_BROWSE_PAGE_SIZE);
                    setRawActiveIndex(0);
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                    active
                      ? 'border-brand/40 bg-brand-soft text-brand'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {!hasQuery && suggestionIds.size > 0 ? (
            <Search className="h-3.5 w-3.5 text-brand" aria-hidden />
          ) : null}
          {listLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          {totalMatching === 0
            ? '0 saker'
            : totalMatching === 1
              ? '1 sak'
              : `${Math.min(rows.length, totalMatching)} av ${totalMatching} saker`}
        </p>
      </div>

      {loading && rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Henter saker fra Stortinget…</p>
      ) : rows.length === 0 ? (
        <div className="space-y-2 px-4 py-6 text-sm text-muted-foreground">
          <p>
            {hasQuery
              ? 'Ingen saker matcher søket. Prøv et annet ord, tema eller saksnummer.'
              : categoryFilter
                ? `Ingen saker i «${categoryFilter}» med valgt filter.`
                : resolvedStatusFilter === 'pending'
                  ? 'Ingen saker under behandling akkurat nå.'
                  : resolvedStatusFilter === 'closed'
                    ? 'Ingen ferdigbehandlede saker.'
                    : 'Ingen treff på tittelen ennå. Prøv et mer konkret søk, eller bla i listen over.'}
          </p>
          {(hasQuery || categoryFilter || statusFilter !== null) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-brand hover:underline"
            >
              Nullstill filtre
            </button>
          )}
        </div>
      ) : (
        <>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={listLabel}
            className={cn(
              'divide-y divide-border',
              !isCompact && 'max-h-[min(52vh,28rem)] overflow-auto',
            )}
          >
            {rows.map((option, index) => {
              const isSuggestion = suggestionIds.has(option.id);
              const showBestMatch = isSuggestion && index === 0 && !hasQuery;
              return (
                <li key={option.id} role="presentation">
                  <div className="flex items-stretch gap-0 sm:gap-1">
                    <button
                      type="button"
                      role="option"
                      id={optionId(index)}
                      aria-selected={index === activeIndex}
                      data-option-index={index}
                      data-sak-option={option.id}
                      onMouseEnter={() => setRawActiveIndex(index)}
                      className={cn(
                        'flex min-w-0 flex-1 flex-col items-start px-3 py-3 text-left transition-colors sm:px-4',
                        index === activeIndex ? 'bg-muted/70' : 'hover:bg-muted/70',
                      )}
                      onClick={() => selectRow(option)}
                    >
                      <span className="flex w-full items-start gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                          {option.title}
                        </span>
                        {showBestMatch ? (
                          <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                            Beste treff
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        {option.status ? (
                          <SakProcessingBadge status={option.status} size="sm" />
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {option.category ? `${option.category} · ` : ''}
                          {option.henvisning ? `${option.henvisning} · ` : ''}
                          Sak {option.id}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      data-sak-preview={option.id}
                      onClick={() => setPreviewId(option.id)}
                      className="shrink-0 self-center px-3 py-2 text-xs font-semibold text-brand hover:underline sm:px-4"
                    >
                      Vis
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className="border-t border-border bg-muted/20 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                data-sak-picker-load-more=""
                onClick={() => setVisibleCount((count) => count + SAK_PICKER_BROWSE_PAGE_SIZE)}
                className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-brand hover:bg-muted/50"
              >
                Vis flere saker
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <div data-sak-picker="" className="space-y-3">
      <div>
        <label htmlFor="sak-picker-search" className="mb-1 block text-sm font-medium text-foreground">
          Knytt til en sak
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Søk på tittel eller saksnummer, filtrer på tema, eller bla i listen. Forhåndsvis en sak uten å
          miste det du har skrevet.
        </p>
      </div>

      {selected && !browsing ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-soft/40 px-3 py-3 sm:px-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Valgt sak</p>
            <p className="text-sm font-semibold leading-snug text-foreground">{selected.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {selected.status ? <SakProcessingBadge status={selected.status} size="sm" /> : null}
              {selected.category ? <span>{selected.category}</span> : null}
              {selected.henvisning ? <span>{selected.henvisning}</span> : null}
              <span>Sak {selected.id}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              data-sak-preview={selected.id}
              onClick={() => setPreviewId(selected.id)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand hover:bg-background/80"
            >
              Vis sak
            </button>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                openBrowse();
              }}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground"
            >
              Bytt sak
            </button>
          </div>
        </div>
      ) : isCompact ? (
        <ReuiComboboxTrigger
          data-sak-picker-open=""
          label="Velg sak"
          value={selected?.title ?? ''}
          placeholder={selected ? 'Bytt sak' : 'Velg sak'}
          onClick={openBrowse}
        />
      ) : browseActive ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          {browseBody}
        </div>
      ) : null}

      {isCompact ? (
        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setBrowsing(false);
          }}
          title="Velg en sak"
          description="Søk, filtrer og knytt meningen din til en sak fra Stortinget."
        >
          {browseBody}
        </Drawer>
      ) : null}

      <SakPreviewDialog
        issueId={previewId}
        title={previewOption?.title ?? selected?.title}
        onClose={() => setPreviewId(null)}
        onSelect={
          previewId && previewId !== value
            ? (id) => {
                onChange(id);
                setBrowsing(false);
                setDrawerOpen(false);
                resetFilters();
              }
            : undefined
        }
      />
    </div>
  );
}
