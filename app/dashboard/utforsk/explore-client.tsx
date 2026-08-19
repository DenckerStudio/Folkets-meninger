'use client';

import Link from 'next/link';
import { Search, Filter, ArrowRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import type { SakListItem } from '@/lib/stortinget';
import { getSakKindLabel } from '@/lib/stortinget-sak-presentation';
import { SAK_CATEGORY_BADGE_CLASS, SAK_KIND_BADGE_CLASS } from '@/lib/sak-status';
import { SakProcessingBadge } from '@/components/sak/sak-meta';
import { formatVotingDaysLeftLabel } from '@/lib/sak-voting-window';
import { useState, useEffect, useMemo } from 'react';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';

const VOTE_LABELS: Record<string, string> = {
  for: 'For',
  against: 'Mot',
  abstain: 'Avstår',
};

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
}: {
  initialIssues: SakListItem[];
  issueLabels: Record<string, string[]>;
  popularLabels: string[];
}) {
  const [issues] = useState(initialIssues);
  const { user } = useAuth();
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [voteHistoryLoaded, setVoteHistoryLoaded] = useState(false);

  const [filters, setFilters] = usePersistedState(
    PREFERENCE_KEYS.utforsk.filters,
    DEFAULT_UTFORSK_FILTERS,
    isUtforskFilters
  );

  const displayedUserVotes = user ? userVotes : {};
  const { searchQuery, selectedCategory, selectedStatus, selectedSakKind, selectedAiLabels, sortBy } = filters;
  const activeAiLabels = selectedAiLabels ?? [];
  const firstOpenIssue = issues.find((issue) => issue.votingOpen && issue.status !== 'closed');

  const setSearchQuery = (searchQuery: string) => setFilters((prev) => ({ ...prev, searchQuery }));
  const setSelectedCategory = (selectedCategory: string) =>
    setFilters((prev) => ({ ...prev, selectedCategory }));
  const setSelectedStatus = (selectedStatus: string) => setFilters((prev) => ({ ...prev, selectedStatus }));
  const setSelectedSakKind = (selectedSakKind: string) => setFilters((prev) => ({ ...prev, selectedSakKind }));
  const setSortBy = (sortBy: string) => setFilters((prev) => ({ ...prev, sortBy }));

  const toggleAiLabel = (label: string) => {
    setFilters((prev) => {
      const current = prev.selectedAiLabels ?? [];
      const next = current.includes(label)
        ? current.filter((l) => l !== label)
        : [...current, label];
      return { ...prev, selectedAiLabels: next };
    });
  };

  useEffect(() => {
    if (!user) {
      setVoteHistoryLoaded(true);
      return;
    }
    fetch('/api/user/vote-history')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, string> = {};
        for (const row of data) {
          const id = row.stortinget_issue_id ?? row.issue_id ?? row.id;
          const choice = row.choice ?? row.vote;
          if (id && choice) map[String(id)] = String(choice);
        }
        setUserVotes(map);
      })
      .catch(() => {})
      .finally(() => setVoteHistoryLoaded(true));
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(issues.map((issue) => issue.category));
    return Array.from(cats).sort();
  }, [issues]);

  let displayedIssues = issues;

  if (selectedCategory !== 'Alle kategorier') {
    displayedIssues = displayedIssues.filter((issue) => issue.category === selectedCategory);
  }

  if (selectedStatus === 'Under behandling' || selectedStatus === 'Åpne for stemmer') {
    displayedIssues = displayedIssues.filter((issue) => issue.status !== 'closed');
  } else if (selectedStatus === 'Ferdigbehandlet / Historikk') {
    displayedIssues = displayedIssues.filter((issue) => issue.status === 'closed');
  }

  if (selectedSakKind === 'Lovforslag') {
    displayedIssues = displayedIssues.filter((issue) => issue.sakKind === 'lovforslag');
  } else if (selectedSakKind === 'Representantforslag') {
    displayedIssues = displayedIssues.filter((issue) => issue.sakKind === 'representantforslag');
  }

  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    displayedIssues = displayedIssues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(query) ||
        issue.summary.toLowerCase().includes(query) ||
        issue.id.toString().includes(query)
    );
  }

  if (activeAiLabels.length > 0) {
    displayedIssues = displayedIssues.filter((issue) => {
      const labels = issueLabels[String(issue.id)] ?? [];
      return activeAiLabels.some((label) => labels.includes(label));
    });
  }

  displayedIssues = [...displayedIssues].sort((a, b) => {
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

  return (
    <div className="space-y-8">
      <FadeIn delay={0.1}>
        <PageHeader
          title="Utforsk saker"
          description="Lovforslag og representantforslag fra Stortinget — kildedokumenter. Nasjonale avstemninger med Ja, Nei eller Blank ligger under Avstemninger."
        />
      </FadeIn>

      {user && voteHistoryLoaded && Object.keys(displayedUserVotes).length === 0 ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4">
          <p className="text-sm font-medium text-foreground">Gi din første stemme</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Saker bruker For/Mot/Avstår. Nasjonale avstemninger bruker Ja/Nei/Blank.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {firstOpenIssue ? (
              <Link
                href={routes.sak(String(firstOpenIssue.id))}
                className="inline-flex items-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
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

      <FadeIn delay={0.2} direction="up">
        <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl leading-5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Søk etter saker, stikkord eller saksnummer..."
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-background text-foreground"
              >
                <option value="Alle statuser">Alle statuser</option>
                <option value="Under behandling">Under behandling</option>
                <option value="Ferdigbehandlet / Historikk">Historikk (Ferdigbehandlet)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-background text-foreground"
              >
                <option value="Alle kategorier">Alle kategorier</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <select
                value={selectedSakKind}
                onChange={(e) => setSelectedSakKind(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-background text-foreground"
              >
                <option value="Alle sakstyper">Alle sakstyper</option>
                <option value="Lovforslag">Lovforslag</option>
                <option value="Representantforslag">Representantforslag</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
              </div>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-background text-foreground"
            >
              <option value="Nyeste først">Nyeste først</option>
              <option value="Mest engasjement">Mest engasjement</option>
              <option value="Snart votering">Snart votering</option>
            </select>
          </div>
        </div>
      </FadeIn>

      {popularLabels.length > 0 && (
        <FadeIn delay={0.22} direction="up">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Emne (AI)</p>
            <div className="flex flex-wrap gap-2">
              {popularLabels.map((label) => {
                const active = activeAiLabels.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleAiLabel(label)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-card text-foreground border-border hover:border-muted-foreground/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {activeAiLabels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, selectedAiLabels: [] }))}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Nullstill emner
                </button>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.25} direction="up">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSortBy('Nyeste først')}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
              sortBy === 'Nyeste først'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:border-muted-foreground/40'
            }`}
          >
            Nyeste
          </button>
          <button
            type="button"
            onClick={() => setSortBy('Mest engasjement')}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
              sortBy === 'Mest engasjement'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:border-muted-foreground/40'
            }`}
          >
            Populært
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} direction="up">
        <div className="space-y-4">
          {displayedIssues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Ingen saker funnet som matcher dine kriterier.</div>
          ) : (
            displayedIssues.map((issue, index) => {
              const sakKindLabel = issue.sakKind ? getSakKindLabel(issue.sakKind) : null;
              return (
              <FadeIn key={issue.id} delay={0.1 * Math.min(index, 5)} direction="up">
                <div className="bg-card rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow overflow-hidden">
                  <Link href={`/dashboard/sak/${issue.id}`} className="block p-6 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {issue.sakKind ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SAK_KIND_BADGE_CLASS}`}>
                            {sakKindLabel}
                          </span>
                        ) : null}
                        {issue.category && issue.category !== sakKindLabel ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SAK_CATEGORY_BADGE_CLASS}`}>
                            {issue.category}
                          </span>
                        ) : null}
                        {(issueLabels[String(issue.id)] ?? []).slice(0, 3).map((label) => (
                          <span
                            key={`${issue.id}-${label}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
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

                    <h2 className="text-xl font-semibold text-foreground mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {issue.title}
                    </h2>
                    {issue.henvisning ? (
                      <p className="text-sm text-muted-foreground mb-2">{issue.henvisning}</p>
                    ) : null}
                    <p className="text-muted-foreground mb-4 line-clamp-2">{issue.summary}</p>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <span className="font-medium text-foreground mr-1">{formatNumber(issue.votes.total)}</span>{' '}
                          stemmer
                        </div>
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center">
                        Les mer <ArrowRight className="ml-1 w-4 h-4" />
                      </div>
                    </div>
                  </Link>

                  <div className="px-6 py-4 bg-muted/40 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {displayedUserVotes[String(issue.id)] ? (
                      <p className="text-sm text-foreground">
                        Du har stemt:{' '}
                        <span className="font-semibold">
                          {VOTE_LABELS[displayedUserVotes[String(issue.id)]] ??
                            displayedUserVotes[String(issue.id)]}
                        </span>
                        <span className="text-muted-foreground"> (anonymt i statistikken)</span>
                      </p>
                    ) : issue.status === 'closed' ? (
                      <p className="text-sm text-muted-foreground">Saken er ferdigbehandlet i Stortinget.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Stem på saken for å registrere din mening.</p>
                    )}
                    <Link
                      href={routes.sak(String(issue.id))}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shrink-0"
                    >
                      {issue.status === 'closed' || !issue.votingOpen ? 'Se resultat' : 'Gå til sak og stem'}
                      <ArrowRight className="ml-1.5 w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </FadeIn>
              );
            })
          )}
        </div>
      </FadeIn>
    </div>
  );
}
