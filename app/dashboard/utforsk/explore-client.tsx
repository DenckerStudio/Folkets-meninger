'use client';

import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import type { SakListItem } from '@/lib/stortinget';
import { getSakKindLabel } from '@/lib/stortinget-sak-presentation';
import { SAK_CATEGORY_BADGE_CLASS, SAK_KIND_BADGE_CLASS } from '@/lib/sak-status';
import { SakProcessingBadge } from '@/components/sak/sak-meta';
import { formatVotingDaysLeftLabel } from '@/lib/sak-voting-window';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LayoutGroup } from 'motion/react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardSearchClass } from '@/components/dashboard/filter-field';
import { ChipGroup } from '@/components/ui/chip-group';
import { FilterTokenBar, type FilterToken } from '@/components/ui/filter-token-bar';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import { MotionList, MotionListRow } from '@/components/motion/list-row';
import { SectionSettle } from '@/components/motion/section-settle';
import { TabUnderline } from '@/components/motion/tab-underline';
import { pollBallotSlugPhrase } from '@/lib/polls/ballot-buttons';
import { PageHeader } from '@/components/page-header';
import { UtforskReelsStage, ReelsEntryCta } from '@/components/polls/utforsk-reels-stage';
import { useAuth } from '@/hooks/use-auth';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';
import type { SystemReelFeedItem } from '@/lib/polls/types';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';

import { ISSUE_STANCE_LABELS, type IssueStance } from '@/lib/stances/types';
import { issueMatchesStortingetSearch } from '@/lib/stortinget-issue-search';

const ISSUE_PAGE_SIZE = 24;
const LABEL_CHIP_LIMIT = 12;

function votingUrgency(issue: SakListItem): number {
  if (issue.votingOpen && issue.votingDaysLeft != null && issue.votingDaysLeft > 0) {
    return issue.votingDaysLeft;
  }
  return Number.POSITIVE_INFINITY;
}

function issueEngagementTotal(issue: SakListItem): number {
  return issue.votes?.total ?? 0;
}

const UTFORSK_SORT_VALUES = ['Nyeste først', 'Mest engasjement', 'Snart votering'] as const;
type UtforskSort = (typeof UTFORSK_SORT_VALUES)[number];

const UTFORSK_DEFAULT_STATUS = 'Alle statuser';
const UTFORSK_DEFAULT_SAK_KIND = 'Alle sakstyper';
const UTFORSK_DEFAULT_SORT: UtforskSort = 'Nyeste først';
/** One-time migration from pre-sort localStorage blob; removed on read. */
const LEGACY_UTFORSK_FILTERS_STORAGE_KEY = 'folkets:utforsk:filters';

function isUtforskSort(value: unknown): value is UtforskSort {
  return typeof value === 'string' && (UTFORSK_SORT_VALUES as readonly string[]).includes(value);
}

/** Legacy blob in `folkets:utforsk:filters` — only `sortBy` is migrated. */
function readLegacyUtforskSort(): UtforskSort | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_UTFORSK_FILTERS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_UTFORSK_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sortBy?: unknown };
    return isUtforskSort(parsed.sortBy) ? parsed.sortBy : null;
  } catch {
    localStorage.removeItem(LEGACY_UTFORSK_FILTERS_STORAGE_KEY);
    return null;
  }
}

function clearDeprecatedUtforskStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_UTFORSK_FILTERS_STORAGE_KEY);
    const sortRaw = localStorage.getItem(PREFERENCE_KEYS.utforsk.sort);
    if (sortRaw !== null) {
      const parsed = JSON.parse(sortRaw) as unknown;
      if (!isUtforskSort(parsed)) {
        localStorage.removeItem(PREFERENCE_KEYS.utforsk.sort);
      }
    }
  } catch {
    localStorage.removeItem(PREFERENCE_KEYS.utforsk.sort);
  }
}

export default function ExploreClient({
  initialIssues,
  issueLabels,
  popularLabels,
  reelItems,
}: {
  initialIssues: SakListItem[];
  issueLabels: Record<string, string[]>;
  popularLabels: string[];
  reelItems: SystemReelFeedItem[];
}) {
  const [issues] = useState(initialIssues);
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const { user } = useAuth();
  const isMounted = useIsMounted();
  const [userStances, setUserStances] = useState<Record<string, IssueStance>>({});
  const [stanceHistoryLoaded, setStanceHistoryLoaded] = useState(false);

  const [sortBy, setSortByPersisted] = usePersistedState(
    PREFERENCE_KEYS.utforsk.sort,
    UTFORSK_DEFAULT_SORT,
    isUtforskSort,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(UTFORSK_DEFAULT_STATUS);
  const [selectedSakKind, setSelectedSakKind] = useState(UTFORSK_DEFAULT_SAK_KIND);
  const [selectedAiLabels, setSelectedAiLabels] = useState<string[]>([]);

  const displayedUserStances = user ? userStances : {};
  const activeAiLabels = selectedAiLabels;
  const firstOpenIssue = issues.find((issue) => issue.votingOpen && issue.status !== 'closed');

  const legacySortMigratedRef = useRef(false);

  const resetUtforskFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedStatus(UTFORSK_DEFAULT_STATUS);
    setSelectedSakKind(UTFORSK_DEFAULT_SAK_KIND);
    setSelectedAiLabels([]);
    setSortByPersisted(UTFORSK_DEFAULT_SORT);
  }, [setSortByPersisted]);

  const hasActiveUtforskFilters =
    searchQuery.trim() !== '' ||
    selectedStatus !== UTFORSK_DEFAULT_STATUS ||
    selectedSakKind !== UTFORSK_DEFAULT_SAK_KIND ||
    activeAiLabels.length > 0 ||
    sortBy !== UTFORSK_DEFAULT_SORT;

  useEffect(() => {
    if (!isMounted || legacySortMigratedRef.current) return;
    legacySortMigratedRef.current = true;
    clearDeprecatedUtforskStorage();
    const legacySort = readLegacyUtforskSort();
    if (legacySort) setSortByPersisted(legacySort);
  }, [isMounted, setSortByPersisted]);

  const setSelectedStatusFilter = (status: string) => {
    setSelectedStatus(status);
  };
  const setSelectedSakKindFilter = (sakKind: string) => {
    setSelectedSakKind(sakKind);
  };
  const setSortBy = (next: string) => {
    if (isUtforskSort(next)) setSortByPersisted(next);
  };

  const toggleAiLabel = (label: string) => {
    setSelectedAiLabels((current) =>
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label],
    );
  };

  // Compute displayed issues based on current filters
  const computeDisplayedIssues = useCallback(() => {
    let result = issues;
    if (selectedStatus === 'Under behandling' || selectedStatus === 'Åpne for stemmer') {
      result = result.filter((issue) => issue.status !== 'closed');
    } else if (selectedStatus === 'Ferdigbehandlet / Historikk') {
      result = result.filter((issue) => issue.status === 'closed');
    }
    if (selectedSakKind === 'Lovforslag') {
      result = result.filter((issue) => issue.sakKind === 'lovforslag');
    } else if (selectedSakKind === 'Representantforslag') {
      result = result.filter((issue) => issue.sakKind === 'representantforslag');
    } else if (selectedSakKind === 'Andre') {
      result = result.filter(
        (issue) => issue.sakKind !== 'lovforslag' && issue.sakKind !== 'representantforslag',
      );
    }
    if (searchQuery.trim() !== '') {
      result = result.filter((issue) => issueMatchesStortingetSearch(issue, searchQuery));
    }
    if (activeAiLabels.length > 0) {
      result = result.filter((issue) => {
        const labels = issueLabels[String(issue.id)] ?? [];
        return activeAiLabels.some((label) => labels.includes(label));
      });
    }
    if (sortBy === 'Snart votering') {
      // Only saker with a known upcoming voting deadline belong in this view.
      result = result.filter((issue) => votingUrgency(issue) !== Number.POSITIVE_INFINITY);
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'Nyeste først') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'Mest engasjement') {
        const voteDiff = issueEngagementTotal(b) - issueEngagementTotal(a);
        if (voteDiff !== 0) return voteDiff;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'Snart votering') {
        return votingUrgency(a) - votingUrgency(b);
      }
      return 0;
    });
  }, [issues, selectedStatus, selectedSakKind, searchQuery, activeAiLabels, sortBy, issueLabels]);

  const displayedIssues = computeDisplayedIssues();

  // Reset "show more" pagination whenever the filter/sort combination changes,
  // deriving it during render rather than via a setState-in-effect.
  const [visibleCount, setVisibleCount] = useState(ISSUE_PAGE_SIZE);
  const filterKey = useMemo(
    () =>
      JSON.stringify([searchQuery, selectedStatus, selectedSakKind, sortBy, activeAiLabels]),
    [searchQuery, selectedStatus, selectedSakKind, sortBy, activeAiLabels],
  );
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(ISSUE_PAGE_SIZE);
  }
  const visibleIssues = displayedIssues.slice(0, visibleCount);
  const hasMoreIssues = displayedIssues.length > visibleIssues.length;
  const listScopeFiltered = displayedIssues.length !== issues.length;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/user/stance-history')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const map: Record<string, IssueStance> = {};
        for (const row of data) {
          const id = row.stortinget_issue_id ?? row.issue_id ?? row.id;
          const stance = row.stance;
          if (id && stance && ['enig', 'uenig', 'ikke_interessert'].includes(stance)) {
            map[String(id)] = stance as IssueStance;
          }
        }
        setUserStances(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStanceHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filterTokens: FilterToken[] = [
    {
      id: 'status',
      label: 'Status',
      value: selectedStatus,
      options: [
        { value: 'Alle statuser', label: 'Alle statuser' },
        { value: 'Under behandling', label: 'Under behandling' },
        { value: 'Ferdigbehandlet / Historikk', label: 'Historikk (Ferdigbehandlet)' },
      ],
      onChange: setSelectedStatusFilter,
    },
    {
      id: 'sakkind',
      label: 'Sakstype',
      value: selectedSakKind,
      options: [
        { value: 'Alle sakstyper', label: 'Alle sakstyper' },
        { value: 'Lovforslag', label: 'Lovforslag' },
        { value: 'Representantforslag', label: 'Representantforslag' },
        { value: 'Andre', label: 'Andre' },
      ],
      onChange: setSelectedSakKindFilter,
    },
  ];

  return (
    <UtforskReelsStage items={reelItems}>
      {({ openReels, itemCount }) => (
    <DashboardPage>
      <SectionSettle>
        <PageHeader
          title="Utforsk saker"
          description="Lovforslag og representantforslag fra Stortinget."
        />
      </SectionSettle>

      <SectionSettle>
        <ReelsEntryCta onOpen={openReels} itemCount={itemCount} />
      </SectionSettle>

      <SectionSettle>
        <p className="text-sm text-muted-foreground">
          {issues.length > 0
            ? listScopeFiltered
              ? `Viser ${displayedIssues.length} av ${issues.length} saker fra Stortingets sesjon ${STORTINGET_ACTIVE_SESSION_ID} (filtre eller sortering er aktive). Tall under er fra Folkets Meninger og er ikke representative.`
              : `Listen viser ${issues.length} saker fra Stortingets sesjon ${STORTINGET_ACTIVE_SESSION_ID}. Tall under er fra Folkets Meninger og er ikke representative.`
            : 'Saker hentes fra Stortinget. Hvis listen er tom, prøv igjen om litt.'}
        </p>
      </SectionSettle>

      {user &&
      stanceHistoryLoaded &&
      Object.keys(displayedUserStances).length === 0 ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4">
          <h2 className="text-md font-bold text-foreground">
            Del din holdning
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marker om du er enig, uenig eller ikke interessert i saker fra Stortinget.
            Holdningene dine brukes til Valgomat og hjertesaker.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            For andre nasjonale {pollBallotSlugPhrase()}-avstemninger, se Avstemninger.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {firstOpenIssue ? (
              <Link
                href={routes.sak(String(firstOpenIssue.id))}
                className="inline-flex items-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
              >
                Åpne en sak
              </Link>
            ) : issues[0] ? (
              <Link
                href={routes.sak(String(issues[0].id))}
                className="inline-flex items-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
              >
                Åpne en sak
              </Link>
            ) : null}
            <Link
              href={routes.avstemninger}
              className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Gå til avstemninger
            </Link>
          </div>
        </div>
      ) : null}

      <SectionSettle>
        <SurfaceCard className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={dashboardSearchClass()}
                placeholder="Søk i saker"
                autoComplete="off"
              />
            </div>
            {hasActiveUtforskFilters ? (
              <button
                type="button"
                onClick={resetUtforskFilters}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 px-4 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Nullstill
              </button>
            ) : null}
          </div>
          <FilterTokenBar tokens={filterTokens} aria-label="Filtrer saker" />
        </SurfaceCard>
      </SectionSettle>

      {popularLabels.length > 0 && (
        <SectionSettle>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Emne</p>
            <ChipGroup
              ariaLabel="Filtrer på emne"
              options={(labelsExpanded ? popularLabels : popularLabels.slice(0, LABEL_CHIP_LIMIT)).map(
                (label) => ({ value: label, label }),
              )}
              selected={activeAiLabels}
              onToggle={toggleAiLabel}
              onClear={() => setSelectedAiLabels([])}
            />
            {popularLabels.length > LABEL_CHIP_LIMIT ? (
              <button
                type="button"
                onClick={() => setLabelsExpanded((prev) => !prev)}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:text-brand/80"
              >
                {labelsExpanded ? 'Vis færre' : `Vis flere emner (${popularLabels.length})`}
              </button>
            ) : null}
          </div>
        </SectionSettle>
      )}

      <SectionSettle>
        <LayoutGroup>
        <div role="group" aria-label="Sorter saker" className="flex flex-wrap gap-2">
          {(['Nyeste først', 'Mest engasjement', 'Snart votering'] as const).map((option) => {
            const selected = sortBy === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setSortBy(option)}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold border transition-colors active:scale-[0.98] ${
                  selected
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-foreground border-border hover:border-muted-foreground/40'
                }`}
              >
                {option === 'Nyeste først' ? 'Nyeste' : option}
                {selected ? <TabUnderline layoutId="utforsk-sort" /> : null}
              </button>
            );
          })}
        </div>
        </LayoutGroup>
      </SectionSettle>

      <SectionSettle>
        <div className="space-y-4">
          {displayedIssues.length === 0 ? (
            <EmptyState
              title={
                sortBy === 'Snart votering'
                  ? 'Ingen saker med kjent votering'
                  : searchQuery
                    ? 'Ingen saker matcher søket ditt'
                    : 'Ingen saker matcher filtrene'
              }
              description={
                sortBy === 'Snart votering'
                  ? 'Stortinget har ikke publisert en framtidig votering for sakene som matcher filtrene dine ennå.'
                  : searchQuery
                    ? 'Prøv et annet søk, eller nullstill filtrene for å se alle saker.'
                    : 'Prøv å endre søk, status eller emne for å se flere saker.'
              }
              action={
                <button
                  type="button"
                  onClick={resetUtforskFilters}
                  className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Nullstill
                </button>
              }
            />
          ) : (
            <MotionList className="space-y-4">
            {visibleIssues.map((issue) => {
              const sakKindLabel = issue.sakKind
                ? getSakKindLabel(issue.sakKind)
                : null;
              return (
                <MotionListRow id={String(issue.id)} key={issue.id}>
                  <SectionSettle>
                  <div className="bg-card rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow overflow-hidden">
                    <div className="flex flex-col gap-3 px-6 pt-6 pb-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        {issue.sakKind ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SAK_KIND_BADGE_CLASS}`}
                          >
                            {sakKindLabel}
                          </span>
                        ) : null}
                        {issue.category && (!issue.sakKind || issue.category !== sakKindLabel) ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SAK_CATEGORY_BADGE_CLASS}`}
                          >
                            {issue.category}
                          </span>
                        ) : null}
                        {(issueLabels[String(issue.id)] ?? [])
                          .slice(0, 3)
                          .map((label) => (
                            <span
                              key={`${issue.id}-${label}`}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand"
                            >
                              {label}
                            </span>
                          ))}
                        <SakProcessingBadge status={issue.status} size="sm" />
                      </div>
                      <div className="text-sm text-muted-foreground md:text-right">
                        {issue.votingOpen && issue.votingDaysLeft ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">
                            {formatVotingDaysLeftLabel(issue.votingDaysLeft)}
                          </span>
                        ) : issue.date ? (
                          <span>Sist oppdatert: {issue.date}</span>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/sak/${issue.id}`}
                      className="block px-6 pb-4 group"
                      aria-label={`Les sak: ${issue.title}`}
                    >
                      <h2 className="text-xl font-semibold text-foreground mb-2 group-hover:text-brand transition-colors">
                        {issue.title}
                      </h2>
                      {issue.henvisning ? (
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.henvisning}
                        </p>
                      ) : null}
                      {issue.summary ? (
                        <p className="text-muted-foreground mb-4 line-clamp-2">
                          {issue.summary}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-end mt-4">
                        <div className="text-brand text-sm font-medium flex items-center">
                          Les mer <ArrowRight className="ml-1 w-4 h-4" />
                        </div>
                      </div>
                    </Link>

                    <div className="px-6 py-4 bg-muted/40 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {displayedUserStances[String(issue.id)] ? (
                        <p className="text-sm text-foreground">
                          Din holdning:{' '}
                          <span className="font-semibold">
                            {ISSUE_STANCE_LABELS[displayedUserStances[String(issue.id)]]}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Marker holdning for å tilpasse Valgomat og hjertesaker.
                        </p>
                      )}
                      <Link
                        href={routes.sak(String(issue.id))}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
                        aria-label={
                          displayedUserStances[String(issue.id)]
                            ? `Se sak: ${issue.title}`
                            : `Marker holdning på sak: ${issue.title}`
                        }
                      >
                        {displayedUserStances[String(issue.id)] ? 'Se sak' : 'Marker holdning'}
                        <ArrowRight className="ml-1.5 w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                  </SectionSettle>
                </MotionListRow>
              );
            })}
            </MotionList>
          )}
          {hasMoreIssues ? (
            <div className="flex flex-col items-center gap-2 border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">
                Viser {visibleIssues.length} av {displayedIssues.length} saker
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + ISSUE_PAGE_SIZE)}
                className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                Vis flere saker ({Math.min(ISSUE_PAGE_SIZE, displayedIssues.length - visibleIssues.length)} til)
              </button>
            </div>
          ) : displayedIssues.length > ISSUE_PAGE_SIZE ? (
            <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              Alle {displayedIssues.length} saker er lastet inn.
            </p>
          ) : null}
        </div>
      </SectionSettle>
    </DashboardPage>
      )}
    </UtforskReelsStage>
  );
}
