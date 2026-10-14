'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Search, Vote, X } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { dashboardControlClass, dashboardSearchClass } from '@/components/dashboard/filter-field';
import { SurfaceCard } from '@/components/dashboard/surface-card';
import FadeIn from '@/components/fade-in';
import { ComposerBanner } from '@/components/opinions/composer-banner';
import { OpinionCard } from '@/components/opinions/opinion-card';
import { ReelPromoCard, type ReelPromo } from '@/components/opinions/reel-promo-card';
import { PageHeader } from '@/components/page-header';
import { interleaveEvenly } from '@/lib/feeds/mixed';
import { routes } from '@/lib/routes';
import type { OpinionCreateStance, OpinionListItem, SakPickerOption } from '@/lib/opinions/types';

type FolketsMeningerClientProps = {
  opinions: OpinionListItem[];
  sakOptions: SakPickerOption[];
  issueId?: string | null;
  initialCompose?: boolean;
  initialStance?: OpinionCreateStance | null;
  reelPromos?: ReelPromo[];
  /** Poll IDs of Reels currently in the feed, used to gate the Reel chip. */
  reelPollIds?: string[];
};

export function FolketsMeningerClient({
  opinions,
  sakOptions,
  issueId = null,
  initialCompose = false,
  initialStance = null,
  reelPromos = [],
  reelPollIds = [],
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

  const mixed = useMemo(() => interleaveEvenly(displayed, reelPromos), [displayed, reelPromos]);
  const validReelPollIds = useMemo(() => new Set(reelPollIds), [reelPollIds]);

  return (
    <DashboardPage className="space-y-6">
      <FadeIn delay={0.1}>
        <PageHeader
          title="Folkets meninger"
          description="Holdninger og begrunnelser fra innloggede brukere. Ingen mock-data."
        />
      </FadeIn>

      <FadeIn delay={0.12} direction="up">
        <ComposerBanner
          sakOptions={sakOptions}
          initialIssueId={issueId}
          initialExpanded={initialCompose}
          initialStance={initialStance}
        />
      </FadeIn>

      {!issueId ? (
        <FadeIn delay={0.14} direction="up">
          <Link
            href={routes.utforskReels()}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-brand/40 hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Vote className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Stem raskt i Reels</span>
              <span className="block text-sm text-muted-foreground">
                Ja, nei eller blank på saker fra Stortinget — og se hva andre mener.
              </span>
            </span>
            <span className="ml-auto shrink-0 text-sm font-medium text-brand">Åpne</span>
          </Link>
        </FadeIn>
      ) : null}

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
            mixed.map((item, index) => (
              <FadeIn
                key={'stance' in item ? `opinion-${item.id}` : `reel-${item.id}`}
                delay={0.08 * Math.min(index, 5)}
                direction="up"
              >
                {'stance' in item ? (
                  <OpinionCard opinion={item} validReelPollIds={validReelPollIds} />
                ) : (
                  <ReelPromoCard reel={item} />
                )}
              </FadeIn>
            ))
          )}
        </div>
      </FadeIn>
    </DashboardPage>
  );
}
