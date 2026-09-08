'use client';

import { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { ComposerBanner } from '@/components/opinions/composer-banner';
import { OpinionCard } from '@/components/opinions/opinion-card';
import { PageHeader } from '@/components/page-header';
import type { OpinionListItem, SakPickerOption } from '@/lib/opinions/types';

type FolketsMeningerClientProps = {
  opinions: OpinionListItem[];
  sakOptions: SakPickerOption[];
};

export function FolketsMeningerClient({ opinions, sakOptions }: FolketsMeningerClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stanceFilter, setStanceFilter] = useState('Alle');
  const [sortBy, setSortBy] = useState('Nyeste først');

  const displayed = useMemo(() => {
    let next = opinions;
    if (stanceFilter === 'For') next = next.filter((item) => item.stance === 'for');
    if (stanceFilter === 'Blank') next = next.filter((item) => item.stance === 'blank');
    if (stanceFilter === 'Imot') next = next.filter((item) => item.stance === 'imot');

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      next = next.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          (item.issueTitle ?? '').toLowerCase().includes(q),
      );
    }

    return [...next].sort((a, b) => {
      if (sortBy === 'Mest engasjement') {
        return b.counts.total - a.counts.total;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [opinions, searchQuery, sortBy, stanceFilter]);

  return (
    <div className="space-y-3 pb-12">
      <FadeIn delay={0.1}>
        <PageHeader title="Folkets meninger" />
      </FadeIn>

      <FadeIn delay={0.12} direction="up">
        <ComposerBanner sakOptions={sakOptions} />
      </FadeIn>

      <FadeIn delay={0.18} direction="up">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row">
          <div className="relative flex-grow">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søk i folkets meninger"
              className="block w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 sm:text-sm"
            />
          </div>
          <div className="relative">
            <select
              value={stanceFilter}
              onChange={(event) => setStanceFilter(event.target.value)}
              className="block w-full appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-10 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 sm:text-sm"
            >
              <option value="Alle">Alle standpunkt</option>
              <option value="For">For</option>
              <option value="Blank">Blank</option>
              <option value="Imot">Imot</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="block w-full appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-10 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 sm:text-sm md:w-52"
          >
            <option value="Nyeste først">Nyeste først</option>
            <option value="Mest engasjement">Mest engasjement</option>
          </select>
        </div>
      </FadeIn>

      <FadeIn delay={0.22} direction="up">
        <div className="space-y-4">
          {displayed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
              {opinions.length === 0
                ? 'Ingen meninger er delt ennå.'
                : 'Ingen meninger matcher søket.'}
            </div>
          ) : (
            displayed.map((opinion, index) => (
              <FadeIn key={opinion.id} delay={0.08 * Math.min(index, 5)} direction="up">
                <OpinionCard opinion={opinion} />
              </FadeIn>
            ))
          )}
        </div>
      </FadeIn>
    </div>
  );
}
