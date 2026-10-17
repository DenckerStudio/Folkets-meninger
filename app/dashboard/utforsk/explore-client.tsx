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
import { PageHeader } from '@/components/page-header';
import { UtforskReelsStage, ReelsEntryCta } from '@/components/polls/utforsk-reels-stage';
import { useAuth } from '@/hooks/use-auth';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';
import type { SystemReelFeedItem } from '@/lib/polls/types';

import { ISSUE_STANCE_LABELS, type IssueStance } from '@/lib/stances/types';

const ISSUE_PAGE_SIZE = 24;
const LABEL_CHIP_LIMIT = 12;

function votingUrgency(issue: SakListItem): number {
  if (issue.votingOpen && issue.votingDaysLeft != null && issue.votingDaysLeft > 0) {
    return issue.votingDaysLeft;
  }
  return Number.POSITIVE_INFINITY;
}

type UtforskFilters = {
  searchQuery: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedSakKind: string;
  selectedAiLabels: string[];
  sortBy: string;
};

const DEFAULT_UTFORSK_FILTERS: UtforskFilters = {
  searchQuery: '',
  selectedCategory: 'Alle kategorier',
  selectedStatus: 'Alle statuser',
  selectedSakKind: 'Alle sakstyper',
  selectedAiLabels: [],
  sortBy: 'Nyeste først',
};

function isUtforskFilters(value: unknown): value is UtforskFilters {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<UtforskFilters>;
  return (
    typeof v.searchQuery === 'string' &&
    typeof v.selectedCategory === 'string' &&
    typeof v.selectedStatus === 'string' &&
    typeof v.selectedSakKind === 'string' &&
    typeof v.sortBy === 'string' &&
    (v.selectedAiLabels === undefined || Array.isArray(v.selectedAiLabels))
  );
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

  const [filters, setFilters] = usePersistedState(
    PREFERENCE_KEYS.utforsk.filters,
    DEFAULT_UTFORSK_FILTERS,
    isUtforskFilters
  );

  const displayedUserStances = user ? userStances : {};
  const { searchQuery, selectedCategory, selectedStatus, selectedSakKind, selectedAiLabels, sortBy } = filters;
  const activeAiLabels = useMemo(() => selectedAiLabels ?? [], [selectedAiLabels]);
  const firstOpenIssue = issues.find((issue) => issue.votingOpen && issue.status !== 'closed');

  // Track if user has interacted with filters this session (excluding searchQuery)
  const [userTouchedFilters, setUserTouchedFilters] = useState(false);
  const filtersResetRef = useRef(false);

  const setSelectedCategory = (selectedCategory: string) => {
    setUserTouchedFilters(true);
    setFilters((prev) => ({ ...prev, selectedCategory }));
  };
  const setSelectedStatus = (selectedStatus: string) => {
    setUserTouchedFilters(true);
    setFilters((prev) => ({ ...prev, selectedStatus }));
  };
  const setSelectedSakKind = (selectedSakKind: string) => {
    setUserTouchedFilters(true);
    setFilters((prev) => ({ ...prev, selectedSakKind }));
  };
  const setSortBy = (sortBy: string) => {
    setUserTouchedFilters(true);
    setFilters((prev) => ({ ...prev, sortBy }));
  };

  const toggleAiLabel = (label: string) => {
    setUserTouchedFilters(true);
    setFilters((prev) => {
      const current = prev.selectedAiLabels ?? [];
      const next = current.includes(label)
        ? current.filter((l) => l !== label)
        : [...current, label];
      return { ...prev, selectedAiLabels: next };
    });
  };

  const setSearchQuery = (searchQuery: string) => setFilters((prev) => ({ ...prev, searchQuery }));

  // Compute displayed issues based on current filters
  const computeDisplayedIssues = useCallback(() => {
    let result = issues;
    if (selectedCategory !== 'Alle kategorier') {
      result = result.filter((issue) => issue.category === selectedCategory);
    }
    if (selectedStatus === 'Under behandling' || selectedStatus === 'Åpne for stemmer') {
      result = result.filter((issue) => issue.status !== 'closed');
    } else if (selectedStatus === 'Ferdigbehandlet / Historikk') {
      result = result.filter((issue) => issue.status === 'closed');
    }
    if (selectedSakKind === 'Lovforslag') {
      result = result.filter((issue) => issue.sakKind === 'lovforslag');
    } else if (selectedSakKind === 'Representantforslag') {
      result = result.filter((issue) => issue.sakKind === 'representantforslag');
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.summary.toLowerCase().includes(query) ||
          issue.id.toString().includes(query)
      );
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
        return b.votes.total - a.votes.total;
      }
      if (sortBy === 'Snart votering') {
        return votingUrgency(a) - votingUrgency(b);
      }
      return 0;
    });
  }, [issues, selectedCategory, selectedStatus, selectedSakKind, searchQuery, activeAiLabels, sortBy, issueLabels]);

  const displayedIssues = computeDisplayedIssues();

  // Reset "show more" pagination whenever the filter/sort combination changes,
  // deriving it during render rather than via a setState-in-effect.
  const visibleCountState = useState(ISSUE_PAGE_SIZE);
  const [visibleCount, setVisibleCount] = visibleCountState;
  const filterKey = useMemo(
    () =>
      JSON.stringify([
        displayedIssues.length,
        searchQuery,
        selectedCategory,
        selectedStatus,
        selectedSakKind,
        sortBy,
        activeAiLabels,
      ]),
    [displayedIssues.length, searchQuery, selectedCategory, selectedStatus, selectedSakKind, sortBy, activeAiLabels],
  );
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(ISSUE_PAGE_SIZE);
  }
  const visibleIssues = displayedIssues.slice(0, visibleCount);
  const hasMoreIssues = displayedIssues.length > visibleIssues.length;

  // On first mount, if persisted filters (from storage) yield 0 results but issues exist
  // and user hasn't touched filters this session, reset non-search filters to defaults once
  useEffect(() => {
    if (!isMounted) return;
    if (filtersResetRef.current) return;
    filtersResetRef.current = true;
    const allDefaultFilters =
      searchQuery === '' &&
      selectedCategory === 'Alle kategorier' &&
      selectedStatus === 'Alle statuser' &&
      selectedSakKind === 'Alle sakstyper' &&
      activeAiLabels.length === 0;
    if (displayedIssues.length === 0 && issues.length > 0 && !allDefaultFilters && !userTouchedFilters) {
      setFilters((prev) => ({
        ...prev,
        selectedCategory: 'Alle kategorier',
        selectedStatus: 'Alle statuser',
        selectedSakKind: 'Alle sakstyper',
        selectedAiLabels: [],
        sortBy: 'Nyeste først',
      }));
    }
  }, [isMounted, searchQuery, selectedCategory, selectedStatus, selectedSakKind, activeAiLabels, displayedIssues.length, issues.length, userTouchedFilters, setFilters]);

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

  const categories = useMemo(() => {
    const cats = new Set(issues.map((issue) => issue.category));
    return Array.from(cats).sort();
  }, [issues]);

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
      onChange: setSelectedStatus,
    },
    {
      id: 'category',
      label: 'Kategori',
      value: selectedCategory,
      options: [
        { value: 'Alle kategorier', label: 'Alle kategorier' },
        ...categories.map((cat) => ({ value: cat, label: cat })),
      ],
      onChange: setSelectedCategory,
    },
    {
      id: 'sakkind',
      label: 'Sakstype',
      value: selectedSakKind,
      options: [
        { value: 'Alle sakstyper', label: 'Alle sakstyper' },
        { value: 'Lovforslag', label: 'Lovforslag' },
        { value: 'Representantforslag', label: 'Representantforslag' },
      ],
      onChange: setSelectedSakKind,
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
            For andre nasjonale ja/nei/blank-avstemninger, se Avstemninger.
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
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={dashboardSearchClass()}
              placeholder="Søk i saker"
            />
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
              onClear={() => setFilters((prev) => ({ ...prev, selectedAiLabels: [] }))}
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
        <div role="tablist" aria-label="Sorter saker" className="flex flex-wrap gap-2">
          {(['Nyeste først', 'Mest engasjement', 'Snart votering'] as const).map((option) => {
            const selected = sortBy === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={selected}
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
                  onClick={() => setFilters(DEFAULT_UTFORSK_FILTERS)}
                  className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Nullstill filtre
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
                    <Link
                      href={`/dashboard/sak/${issue.id}`}
                      className="block p-6 pb-4 group"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-wrap">
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
                        <div className="text-sm text-muted-foreground text-right">
                          {issue.votingOpen && issue.votingDaysLeft ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">
                              {formatVotingDaysLeftLabel(issue.votingDaysLeft)}
                            </span>
                          ) : issue.date ? (
                            <span>Sist oppdatert: {issue.date}</span>
                          ) : null}
                        </div>
                      </div>

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
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Viser {visibleIssues.length} av {displayedIssues.length} saker
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + ISSUE_PAGE_SIZE)}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Vis flere saker
              </button>
            </div>
          ) : null}
        </div>
      </SectionSettle>
    </DashboardPage>
      )}
    </UtforskReelsStage>
  );
}
