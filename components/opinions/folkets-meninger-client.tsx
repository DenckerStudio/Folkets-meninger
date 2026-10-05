'use client';

import { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardControlClass, dashboardSearchClass } from '@/components/dashboard/filter-field';
import { SurfaceCard } from '@/components/dashboard/surface-card';
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
    <DashboardPage className="space-y-6">
      <FadeIn delay={0.1}>
        <PageHeader
          title="Folkets meninger"
          description="Holdninger og begrunnelser fra innloggede brukere. Ingen mock-data."
        />
      </FadeIn>

      <FadeIn delay={0.12} direction="up">
        <ComposerBanner sakOptions={sakOptions} />
      </FadeIn>

      <FadeIn delay={0.18} direction="up">
        <SurfaceCard className="flex flex-col gap-4 p-4 md:flex-row">
          <div className="relative flex-grow">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søk i folkets meninger"
              className={dashboardSearchClass()}
            />
          </div>
          <div className="relative">
            <select
              value={stanceFilter}
              onChange={(event) => setStanceFilter(event.target.value)}
              className={dashboardControlClass()}
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
            className={dashboardControlClass('md:w-52')}
          >
            <option value="Nyeste først">Nyeste først</option>
            <option value="Mest engasjement">Mest engasjement</option>
          </select>
        </SurfaceCard>
      </FadeIn>

      <FadeIn delay={0.22} direction="up">
        <div className="space-y-4">
          {displayed.length === 0 ? (
            <EmptyState
              title={opinions.length === 0 ? 'Ingen meninger er delt ennå' : 'Ingen meninger matcher søket'}
              description={
                opinions.length === 0
                  ? 'Når noen deler en holdning til en sak, vises den her.'
                  : 'Prøv et annet søk eller filter.'
              }
            />
          ) : (
            displayed.map((opinion, index) => (
              <FadeIn key={opinion.id} delay={0.08 * Math.min(index, 5)} direction="up">
                <OpinionCard opinion={opinion} />
              </FadeIn>
            ))
          )}
        </div>
      </FadeIn>
    </DashboardPage>
  );
}
