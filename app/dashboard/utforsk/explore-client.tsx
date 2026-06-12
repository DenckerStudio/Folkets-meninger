'use client';

import Link from 'next/link';
import { Search, Filter, ArrowRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import type { SakListItem } from '@/lib/stortinget';
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

type UtforskFilters = {
  searchQuery: string;
  selectedCategory: string;
  selectedStatus: string;
  selectedAiLabels: string[];
  sortBy: string;
};

const DEFAULT_UTFORSK_FILTERS: UtforskFilters = {
  searchQuery: '',
  selectedCategory: 'Alle kategorier',
  selectedStatus: 'Alle statuser',
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

  const [filters, setFilters] = usePersistedState(
    PREFERENCE_KEYS.utforsk.filters,
    DEFAULT_UTFORSK_FILTERS,
    isUtforskFilters
  );

  const displayedUserVotes = user ? userVotes : {};
  const { searchQuery, selectedCategory, selectedStatus, selectedAiLabels, sortBy } = filters;

  const setSearchQuery = (searchQuery: string) => setFilters((prev) => ({ ...prev, searchQuery }));
  const setSelectedCategory = (selectedCategory: string) =>
    setFilters((prev) => ({ ...prev, selectedCategory }));
  const setSelectedStatus = (selectedStatus: string) => setFilters((prev) => ({ ...prev, selectedStatus }));
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
    if (!user) return;
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
      .catch(() => {});
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(issues.map((issue) => issue.category));
    return Array.from(cats).sort();
  }, [issues]);

  let displayedIssues = issues;

  if (selectedCategory !== 'Alle kategorier') {
    displayedIssues = displayedIssues.filter((issue) => issue.category === selectedCategory);
  }

  const activeAiLabels = selectedAiLabels ?? [];
  if (activeAiLabels.length > 0) {
    displayedIssues = displayedIssues.filter((issue) => {
      const labels = issueLabels[String(issue.id)] ?? [];
      return activeAiLabels.some((label) => labels.includes(label));
    });
  }

  if (selectedStatus === 'Åpne for stemmer') {
    displayedIssues = displayedIssues.filter((issue) => issue.status !== 'closed');
  } else if (selectedStatus === 'Ferdigbehandlet / Historikk') {
    displayedIssues = displayedIssues.filter((issue) => issue.status === 'closed');
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

  displayedIssues = [...displayedIssues].sort((a, b) => {
    if (sortBy === 'Nyeste først') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortBy === 'Mest engasjement') {
      return b.votes.total - a.votes.total;
    }
    if (sortBy === 'Snart votering') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return 0;
  });

  return (
    <div className="space-y-8">
      <FadeIn delay={0.1}>
        <PageHeader title="Utforsk saker" description="Søk og filtrer blant alle saker fra Stortinget." />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Søk etter saker, stikkord eller saksnummer..."
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-white"
              >
                <option value="Alle statuser">Alle statuser</option>
                <option value="Åpne for stemmer">Åpne for stemmer</option>
                <option value="Ferdigbehandlet / Historikk">Historikk (Ferdigbehandlet)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <Filter className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-white"
              >
                <option value="Alle kategorier">Alle kategorier</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <Filter className="h-4 w-4" />
              </div>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border appearance-none bg-white"
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
            <p className="text-sm font-medium text-gray-700">Emne (AI)</p>
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
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
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
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
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
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            Nyeste
          </button>
          <button
            type="button"
            onClick={() => setSortBy('Mest engasjement')}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
              sortBy === 'Mest engasjement'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            Populært
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} direction="up">
        <div className="space-y-4">
          {displayedIssues.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Ingen saker funnet som matcher dine kriterier.</div>
          ) : (
            displayedIssues.map((issue, index) => (
              <FadeIn key={issue.id} delay={0.1 * Math.min(index, 5)} direction="up">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden">
                  <Link href={`/dashboard/sak/${issue.id}`} className="block p-6 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {issue.category}
                        </span>
                        {(issueLabels[String(issue.id)] ?? []).slice(0, 3).map((label) => (
                          <span
                            key={`${issue.id}-${label}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700"
                          >
                            {label}
                          </span>
                        ))}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            issue.status === 'closed' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {issue.status === 'closed' ? 'Ferdigbehandlet' : 'Åpen for stemmer'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">Votering: {issue.date}</span>
                    </div>

                    <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                      {issue.title}
                    </h2>
                    <p className="text-gray-600 mb-4 line-clamp-2">{issue.summary}</p>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 mr-1">{formatNumber(issue.votes.total)}</span>{' '}
                          stemmer
                        </div>
                      </div>
                      <div className="text-indigo-600 text-sm font-medium flex items-center">
                        Les mer <ArrowRight className="ml-1 w-4 h-4" />
                      </div>
                    </div>
                  </Link>

                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {displayedUserVotes[String(issue.id)] ? (
                      <p className="text-sm text-gray-700">
                        Du har stemt:{' '}
                        <span className="font-semibold text-gray-900">
                          {VOTE_LABELS[displayedUserVotes[String(issue.id)]] ??
                            displayedUserVotes[String(issue.id)]}
                        </span>
                        <span className="text-gray-500"> (anonymt i statistikken)</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">Stem på saken for å registrere din mening.</p>
                    )}
                    <Link
                      href={routes.sak(String(issue.id))}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shrink-0"
                    >
                      Gå til sak og stem
                      <ArrowRight className="ml-1.5 w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ))
          )}
        </div>
      </FadeIn>
    </div>
  );
}
