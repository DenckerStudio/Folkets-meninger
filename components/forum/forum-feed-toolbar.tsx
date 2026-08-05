'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { ForumSort } from '@/lib/forum/queries';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { readLocalStorage, writeLocalStorage } from '@/lib/preferences/local-storage';
import { cn } from '@/lib/utils';

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
    <div className="mb-2 space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
          placeholder="Søk i diskusjoner…"
          className="w-full rounded-2xl border-0 bg-gray-50/90 py-3 pl-11 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          autoComplete="off"
        />
        {(query || hasActiveSearch) && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:bg-gray-200/60 hover:text-gray-600"
            aria-label="Tøm søk"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-gray-900">
          {hasActiveSearch ? 'Søkeresultater' : 'Diskusjoner'}
        </h2>
        <div
          className="inline-flex rounded-xl bg-gray-100/80 p-0.5"
          role="group"
          aria-label="Sorter diskusjoner"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSortChange(opt.value)}
              className={cn(
                'rounded-[0.65rem] px-3 py-1.5 text-xs font-semibold transition-colors',
                sort === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
