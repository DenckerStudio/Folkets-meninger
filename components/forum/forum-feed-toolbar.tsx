'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Search, X } from 'lucide-react';
import type { ForumSort } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { readLocalStorage, writeLocalStorage } from '@/lib/preferences/local-storage';

const OPTIONS: { value: ForumSort; label: string }[] = [
  { value: 'nyeste', label: 'Nyeste' },
  { value: 'engasjert', label: 'Mest engasjert' },
];

function buildForumQuery(opts: {
  sort: ForumSort;
  sak: string | null;
  q: string;
}): string {
  const params = new URLSearchParams();
  if (opts.sort !== 'nyeste') params.set('sort', opts.sort);
  if (opts.sak) params.set('sak', opts.sak);
  const trimmed = opts.q.trim();
  if (trimmed.length >= 2) params.set('q', trimmed);
  const qs = params.toString();
  return qs ? `${routes.forum}?${qs}` : routes.forum;
}

export default function ForumFeedToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = (searchParams.get('sort') as ForumSort) || 'nyeste';
  const sak = searchParams.get('sak');
  const qFromUrl = searchParams.get('q') || '';
  const restoredSortRef = useRef(false);

  const [query, setQuery] = useState(qFromUrl);

  useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    if (restoredSortRef.current || searchParams.get('sort')) return;
    restoredSortRef.current = true;
    const persisted = readLocalStorage<ForumSort>(PREFERENCE_KEYS.forum.sort);
    if (persisted === 'engasjert' || persisted === 'nyeste') {
      router.replace(buildForumQuery({ sort: persisted, sak, q: qFromUrl }));
    }
  }, [qFromUrl, router, sak, searchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    const urlTrimmed = qFromUrl.trim();
    if (trimmed === urlTrimmed) return;

    const t = setTimeout(() => {
      router.replace(buildForumQuery({ sort, sak, q: query }));
    }, 350);

    return () => clearTimeout(t);
  }, [query, qFromUrl, router, sak, sort]);

  const handleSortChange = (next: ForumSort) => {
    writeLocalStorage(PREFERENCE_KEYS.forum.sort, next);
    router.push(buildForumQuery({ sort: next, sak, q: qFromUrl }));
  };

  const clearSearch = () => {
    setQuery('');
    router.replace(buildForumQuery({ sort, sak, q: '' }));
  };

  const hasActiveSearch = qFromUrl.trim().length >= 2;

  return (
    <div className="mb-4 space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          aria-hidden
        />
        <label htmlFor="forum-search" className="sr-only">
          Søk i diskusjoner
        </label>
        <input
          id="forum-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk i tittel og innlegg…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          autoComplete="off"
        />
        {(query || hasActiveSearch) && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Tøm søk"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900">
          {hasActiveSearch ? 'Søkeresultater' : 'Diskusjoner'}
        </h2>
        <div className="relative shrink-0">
          <label htmlFor="forum-sort" className="sr-only">
            Sorter
          </label>
          <select
            id="forum-sort"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as ForumSort)}
            className="appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
