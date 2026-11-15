'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Search } from 'lucide-react';
import type { SporsmalType } from '@/lib/stortinget';
import {
  formatSporsmalDate,
  formatSporsmalStatus,
  getSporsmalFraNavn,
  getSporsmalTitle,
  isSporsmalBesvart,
  type StortingetSporsmal,
} from '@/lib/stortinget-sporsmal';
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardControlClass, dashboardSearchClass } from '@/components/dashboard/filter-field';
import { Pagination } from '@/components/ui/pagination';
import {
  SPORSMAL_PAGE_SIZE,
  filterSporsmalList,
  paginateList,
  sortSporsmalForDisplay,
  sortGroupedSporsmalThemes,
  countByTheme,
  uniqueParties,
  uniqueRepresentatives,
  type SporsmalAnswerFilter,
  type SporsmalListItemView,
} from '@/lib/sporsmal/filter';
import { SPORSMAL_THEME_LABELS, type SporsmalThemeLabel } from '@/lib/sporsmal/themes';
import { SporsmalTypeTabs } from '@/components/sporsmal/sporsmal-type-tabs';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type SporsmalListProps = {
  sporsmal: StortingetSporsmal[];
  type: SporsmalType;
  sesjonId: string;
  sakBySporsmalId: Record<string, string | null>;
};

function readAnswerFilter(value: string | null): SporsmalAnswerFilter {
  if (value === 'besvart' || value === 'ubesvart') return value;
  return 'alle';
}

export default function SporsmalList({ sporsmal, type, sesjonId, sakBySporsmalId }: SporsmalListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const themeFilter = searchParams.get('tema') as SporsmalThemeLabel | null;
  const partyId = searchParams.get('parti');
  const representativeId = searchParams.get('fra');
  const answerFilter = readAnswerFilter(searchParams.get('status'));
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const [searchDraft, setSearchDraft] = useState(query);

  useEffect(() => {
    setSearchDraft(query);
  }, [query]);

  const sakMap = useMemo(() => new Map(Object.entries(sakBySporsmalId)), [sakBySporsmalId]);

  const filtered = useMemo(() => {
    const items = filterSporsmalList(
      sporsmal,
      {
        query,
        theme:
          themeFilter && SPORSMAL_THEME_LABELS.includes(themeFilter as SporsmalThemeLabel)
            ? (themeFilter as SporsmalThemeLabel)
            : null,
        partyId,
        representativeId,
        answerFilter,
      },
      sakMap,
    );
    return sortSporsmalForDisplay(items);
  }, [sporsmal, query, themeFilter, partyId, representativeId, answerFilter, sakMap]);

  const paginated = useMemo(
    () => paginateList(filtered, page, SPORSMAL_PAGE_SIZE),
    [filtered, page],
  );

  const themeCounts = useMemo(() => {
    const withoutTheme = filterSporsmalList(
      sporsmal,
      {
        query,
        theme: null,
        partyId,
        representativeId,
        answerFilter,
      },
      sakMap,
    );
    return countByTheme(withoutTheme);
  }, [sporsmal, query, partyId, representativeId, answerFilter, sakMap]);
  const parties = useMemo(() => uniqueParties(sporsmal), [sporsmal]);
  const representatives = useMemo(
    () => uniqueRepresentatives(sporsmal, partyId),
    [sporsmal, partyId],
  );

  const pushParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const resetFilters = () => {
    setSearchDraft('');
    const params = new URLSearchParams({ type, sesjonId });
    router.push(`${pathname}?${params.toString()}`);
  };

  const showGrouped = !query.trim() && !themeFilter;
  const pageItems = paginated.items;

  const groups = useMemo(() => {
    if (!showGrouped) return null;
    const map = new Map<SporsmalThemeLabel, SporsmalListItemView[]>();
    for (const item of pageItems) {
      const list = map.get(item.theme) ?? [];
      list.push(item);
      map.set(item.theme, list);
    }
    return sortGroupedSporsmalThemes([...map.entries()]);
  }, [pageItems, showGrouped]);

  const renderRow = (item: SporsmalListItemView, idx: number) => {
    const title = getSporsmalTitle(item);
    const sendt = formatSporsmalDate(item.sendt_dato) ?? formatSporsmalDate(item.datert_dato);
    const statusLabel = formatSporsmalStatus(item.status);
    const fraNavn = getSporsmalFraNavn(item);
    const minister = item.sporsmal_til_minister_tittel;
    const besvart = isSporsmalBesvart(item);

    return (
      <div key={String(item.id ?? idx)} className="px-6 py-4 hover:bg-muted/50 transition-colors">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {item.sporsmal_nummer != null && (
            <span className="text-xs font-medium text-muted-foreground">#{item.sporsmal_nummer}</span>
          )}
          <span className="inline-flex px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground">
            {item.theme}
          </span>
          <span
            className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
              besvart
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
            )}
          >
            {besvart ? 'Besvart' : 'Ubesvart'}
          </span>
          {statusLabel && <span className="text-xs text-muted-foreground">{statusLabel}</span>}
        </div>
        {item.id ? (
          <Link
            href={routes.sporsmalDetail(String(item.id))}
            className="text-sm font-semibold text-foreground hover:text-brand line-clamp-2"
          >
            {title}
          </Link>
        ) : (
          <div className="text-sm font-semibold text-foreground line-clamp-2">{title}</div>
        )}
        <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {fraNavn && (
            <span>
              Fra{' '}
              {item.sporsmal_fra?.id ? (
                <Link href={routes.politiker(item.sporsmal_fra.id)} className="text-brand hover:underline">
                  {fraNavn}
                </Link>
              ) : (
                fraNavn
              )}
            </span>
          )}
          {minister && <span>Til {minister}</span>}
          {sendt && <span>{sendt}</span>}
        </div>
        {item.sakId ? (
          <div className="mt-2">
            <Link
              href={routes.sak(item.sakId)}
              className="inline-flex min-h-11 items-center text-xs font-medium text-brand hover:underline"
            >
              Relatert stortingssak →
            </Link>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SporsmalTypeTabs activeType={type} sesjonId={sesjonId} />

      <div className="flex flex-wrap gap-2">
        <Link
          href={routes.sporsmal}
          onClick={(event) => {
            event.preventDefault();
            pushParams((params) => {
              params.delete('tema');
              params.delete('page');
            });
          }}
          aria-pressed={!themeFilter}
          className={cn(
            'px-3 py-2 rounded-xl text-xs font-semibold border min-h-11 inline-flex items-center',
            !themeFilter ? 'bg-muted text-brand border-border' : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
          )}
        >
          Alle tema
        </Link>
        {SPORSMAL_THEME_LABELS.filter((label) => (themeCounts[label] ?? 0) > 0).map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={themeFilter === label}
            onClick={() =>
              pushParams((params) => {
                if (params.get('tema') === label) params.delete('tema');
                else params.set('tema', label);
                params.delete('page');
              })
            }
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-semibold border min-h-11',
              themeFilter === label
                ? 'bg-muted text-brand border-border'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
            )}
          >
            {label} ({themeCounts[label] ?? 0})
          </button>
        ))}
      </div>

      <form
        className="flex flex-col md:flex-row gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          pushParams((params) => {
            const next = searchDraft.trim();
            if (next) params.set('q', next);
            else params.delete('q');
            params.delete('page');
          });
        }}
      >
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Søk i tittel og tekst, politiker, minister eller emne…"
            aria-label="Søk i spørsmål"
            className={dashboardSearchClass()}
          />
        </div>
        <select
          value={partyId ?? ''}
          onChange={(e) =>
            pushParams((params) => {
              const value = e.target.value;
              if (value) params.set('parti', value);
              else params.delete('parti');
              params.delete('fra');
              params.delete('page');
            })
          }
          aria-label="Filtrer på parti"
          className={dashboardControlClass('md:w-44')}
        >
          <option value="">Alle parti</option>
          {parties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
        </select>
        <select
          value={representativeId ?? ''}
          onChange={(e) =>
            pushParams((params) => {
              const value = e.target.value;
              if (value) params.set('fra', value);
              else params.delete('fra');
              params.delete('page');
            })
          }
          aria-label="Filtrer på representant"
          className={dashboardControlClass('md:w-52')}
        >
          <option value="">Alle representanter</option>
          {representatives.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.name}
              {rep.partyName ? ` (${rep.partyName})` : ''}
            </option>
          ))}
        </select>
        <select
          value={answerFilter}
          onChange={(e) =>
            pushParams((params) => {
              const value = e.target.value;
              if (value === 'alle') params.delete('status');
              else params.set('status', value);
              params.delete('page');
            })
          }
          aria-label="Filtrer på svarstatus"
          className={dashboardControlClass('md:w-auto')}
        >
          <option value="alle">Alle</option>
          <option value="besvart">Besvart</option>
          <option value="ubesvart">Ubesvart</option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Søk
        </button>
        {(query || themeFilter || partyId || representativeId || answerFilter !== 'alle') && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Nullstill
          </button>
        )}
      </form>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border text-sm text-muted-foreground">
          {filtered.length} av {sporsmal.length} spørsmål · side {paginated.page} av {paginated.totalPages}
        </div>
        {pageItems.length === 0 ? (
          <EmptyState
            compact
            className="m-4"
            title="Ingen spørsmål matcher filtrene"
            description="Prøv et annet søk eller filter, eller utforsk saker på Utforsk."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Nullstill filtre
                </button>
                <Link
                  href={routes.utforsk}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Gå til Utforsk
                </Link>
              </div>
            }
          />
        ) : groups ? (
          <div className="divide-y divide-border">
            {groups.map(([theme, items]) => (
              <section key={theme}>
                <div className="px-6 py-3 bg-muted/40 text-sm font-semibold text-foreground">{theme}</div>
                <div className="divide-y divide-border">{items.map((item, idx) => renderRow(item, idx))}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">{pageItems.map((item, idx) => renderRow(item, idx))}</div>
        )}
        <div className="px-6 py-4 border-t border-border">
          <Pagination
            currentPage={paginated.page}
            totalPages={paginated.totalPages}
            onPageChange={(nextPage) =>
              pushParams((params) => {
                if (nextPage <= 1) params.delete('page');
                else params.set('page', String(nextPage));
              })
            }
            ariaLabel="Paginering for spørsmål"
          />
        </div>
      </div>
    </div>
  );
}