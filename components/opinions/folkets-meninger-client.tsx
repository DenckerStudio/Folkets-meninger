'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Search, X } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardControlClass, dashboardSearchClass } from '@/components/dashboard/filter-field';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import FadeIn from '@/components/fade-in';
import { ComposerBanner } from '@/components/opinions/composer-banner';
import { OpinionCard } from '@/components/opinions/opinion-card';
import { PageHeader } from '@/components/page-header';
import { ShareTrigger } from '@/components/share/share-trigger';
import { routes } from '@/lib/routes';
import type { OpinionListItem, SakPickerOption } from '@/lib/opinions/types';

type FolketsMeningerClientProps = {
  opinions: OpinionListItem[];
  sakOptions: SakPickerOption[];
  issueId?: string | null;
  initialCompose?: boolean;
};

export function FolketsMeningerClient({
  opinions,
  sakOptions,
  issueId = null,
  initialCompose = false,
}: FolketsMeningerClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stanceFilter, setStanceFilter] = useState('Alle');
  const [sortBy, setSortBy] = useState('Nyeste først');

  const scopedTitle = useMemo(() => {
    if (!issueId) return null;
    return sakOptions.find((option) => option.id === issueId)?.title ?? null;
  }, [issueId, sakOptions]);

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
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            title="Folkets meninger"
            description="Holdninger og begrunnelser fra innloggede brukere."
          />
          <ShareTrigger
            ariaLabel="Del Folkets meninger"
            dialogTitle={scopedTitle ? 'Del meningene om saken' : 'Del Folkets meninger'}
            url={issueId ? routes.folketsMeningerForSak(issueId) : routes.folketsMeninger}
            title={scopedTitle ? `Folkets meninger om ${scopedTitle}` : 'Folkets meninger'}
            text={
              scopedTitle
                ? `Se hva folk mener om «${scopedTitle}» på Folkets Meninger`
                : 'Se hva folk mener om sakene på Stortinget'
            }
            description="Les og del meninger om Stortingssaker. Ett innlegg per bruker, med for- og imot-punkter."
            className="mt-1"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.12} direction="up">
        <ComposerBanner
          sakOptions={sakOptions}
          initialIssueId={issueId}
          initialExpanded={initialCompose}
        />
      </FadeIn>

      {issueId ? (
        <FadeIn delay={0.15} direction="up">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-brand/25 bg-brand-soft/40 px-4 py-3">
            <span className="text-sm text-foreground">
              Viser meninger om{' '}
              <strong className="font-semibold">{scopedTitle ?? `Sak ${issueId}`}</strong>
            </span>
            <Link
              href={routes.folketsMeninger}
              className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              Vis alle meninger
              <X className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      ) : null}

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
              title={
                opinions.length === 0
                  ? issueId
                    ? 'Ingen meninger om denne saken ennå'
                    : 'Ingen meninger er delt ennå'
                  : 'Ingen meninger matcher søket'
              }
              description={
                opinions.length === 0
                  ? issueId
                    ? 'Bli den første til å dele en mening om denne saken.'
                    : 'Når noen deler en holdning til en sak, vises den her.'
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
