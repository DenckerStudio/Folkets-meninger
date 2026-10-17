'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Landmark, MapPin, Search, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TeamProfileGrid, TeamProfileGridItem } from '@/components/ui/team-profile-grid';
import { PartyMark } from '@/components/motion/party-mark';
import { SectionSettle } from '@/components/motion/section-settle';
import { PartyLogo } from '@/components/politikere/party-logo';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import type { PolitikerOversikt } from '@/lib/stortinget';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { missingPartyLogos, uniquePartyNames } from '@/lib/party-logos';
import { cn } from '@/lib/utils';

function PolitikerCard({ rep }: { rep: PolitikerOversikt }) {
  const roleLabel = rep.tittel || 'Stortingsrepresentant';
  const locationLabel = rep.departement || rep.fylke.navn;

  return (
    <SectionSettle className="h-full w-full min-w-0">
      <div className="flex h-full min-h-[22rem] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <Link href={routes.politiker(String(rep.id))} className="group block min-w-0 flex-1 p-6 pb-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2 gap-y-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/40">
              <Image
                src={getPersonbildeUrl(rep.id, 'lite', true)}
                alt={`${rep.fornavn} ${rep.etternavn}`}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            {rep.erRegjeringsmedlem ? (
              <span className="inline-flex max-w-full min-w-0 items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                <Landmark className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{roleLabel}</span>
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                <ShieldCheck className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                Representant
              </span>
            )}
          </div>

          <h3 className="mb-1 text-xl font-semibold leading-tight break-words text-foreground transition-colors group-hover:text-brand">
            {rep.fornavn} {rep.etternavn}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">{roleLabel}</p>
          <p className="mt-2 flex min-w-0 items-center text-sm text-muted-foreground">
            <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLabel}</span>
          </p>

          <div className="mt-4 flex items-center justify-end">
            <span className="flex items-center text-sm font-medium text-brand">
              Les mer <ArrowRight className="ml-1 h-4 w-4" />
            </span>
          </div>
        </Link>

        <div className="flex flex-col items-stretch gap-3 border-t border-border bg-muted/40 px-6 py-4">
          <Link
            href={routes.parti(rep.parti.navn)}
            className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-foreground hover:text-brand"
          >
            <PartyMark label={rep.parti.navn} className="h-8 w-8 shrink-0">
              <PartyLogo partyName={rep.parti.navn} className="h-8 w-8" />
            </PartyMark>
            <span className="min-w-0 flex-1 break-words">{rep.parti.navn}</span>
          </Link>
          <Link
            href={routes.politiker(String(rep.id))}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
          >
            Se profil
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </SectionSettle>
  );
}

type PolitikereExplorerProps = {
  politikere: PolitikerOversikt[];
};

function isSearchString(value: unknown): value is string {
  return typeof value === 'string';
}

function matchesSearch(rep: PolitikerOversikt, query: string): boolean {
  return (
    rep.fornavn.toLowerCase().includes(query) ||
    rep.etternavn.toLowerCase().includes(query) ||
    rep.parti.navn.toLowerCase().includes(query) ||
    rep.fylke.navn.toLowerCase().includes(query) ||
    (rep.tittel?.toLowerCase().includes(query) ?? false) ||
    (rep.departement?.toLowerCase().includes(query) ?? false)
  );
}

const PAGE_SIZE = 24;

export default function PolitikereExplorer({ politikere }: PolitikereExplorerProps) {
  const searchParams = useSearchParams();
  const selectedParty = searchParams.get('parti');
  const [pageState, setPageState] = useState<{ key: string; page: number }>({
    key: '',
    page: 1,
  });
  const listRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const [searchQuery, setSearchQuery] = usePersistedState(
    PREFERENCE_KEYS.politikere.search,
    '',
    isSearchString,
  );

  const partyNames = useMemo(
    () => uniquePartyNames(politikere.map((rep) => rep.parti.navn)),
    [politikere],
  );
  const missingLogos = useMemo(() => missingPartyLogos(partyNames), [partyNames]);

  useEffect(() => {
    if (!selectedParty) return;
    const chip = document.getElementById(`party-chip-${selectedParty}`);
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedParty]);

  const filteredPolitikere = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = politikere.filter((rep) => {
      if (selectedParty && rep.parti.navn !== selectedParty) return false;
      if (query && !matchesSearch(rep, query)) return false;
      return true;
    });

    return [...base].sort((a, b) => a.etternavn.localeCompare(b.etternavn, 'no'));
  }, [politikere, searchQuery, selectedParty]);

  const regjeringsmedlemmer = useMemo(
    () =>
      filteredPolitikere
        .filter((p) => p.erRegjeringsmedlem)
        .sort((a, b) => (a.regjeringsSortering ?? 999) - (b.regjeringsSortering ?? 999)),
    [filteredPolitikere],
  );

  const showRegjeringSection = !searchQuery.trim() && !selectedParty && regjeringsmedlemmer.length > 0;

  const listedPolitikere = useMemo(() => {
    if (!showRegjeringSection) return filteredPolitikere;
    const regjeringsIds = new Set(regjeringsmedlemmer.map((p) => p.id));
    return filteredPolitikere.filter((p) => !regjeringsIds.has(p.id));
  }, [filteredPolitikere, regjeringsmedlemmer, showRegjeringSection]);

  const filterKey = `${searchQuery.trim().toLowerCase()}|${selectedParty ?? ''}`;
  const totalPages = Math.max(1, Math.ceil(listedPolitikere.length / PAGE_SIZE));
  const currentPage = Math.min(
    pageState.key === filterKey ? pageState.page : 1,
    totalPages,
  );
  const pagedPolitikere = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return listedPolitikere.slice(start, start + PAGE_SIZE);
  }, [listedPolitikere, currentPage]);

  const changePage = useCallback(
    (next: number) => {
      setPageState({
        key: filterKey,
        page: Math.min(Math.max(1, next), totalPages),
      });
    },
    [filterKey, totalPages],
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const listEl = listRef.current;
    if (!listEl) return;
    const heading = listEl.querySelector('h2, h3, [role="heading"]') as HTMLElement | null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = listEl.getBoundingClientRect();
        const targetY = rect.top + window.scrollY - 96;
        window.scrollTo({ top: targetY, behavior: 'auto' });
        heading?.focus?.({ preventScroll: true });
      });
    });
  }, [currentPage]);

  if (missingLogos.length > 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        Mangler partilogo for: {missingLogos.join(', ')}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <SectionSettle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Trykk på en partilogo for å åpne partiet.</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {partyNames.map((name) => {
              const active = selectedParty === name;
              return (
                <Link
                  key={name}
                  id={`party-chip-${name}`}
                  href={active ? routes.politikere : routes.parti(name)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap',
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-card text-foreground hover:border-brand/40',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <PartyMark label={name} className="h-8 w-8 shrink-0 overflow-visible">
                    <PartyLogo partyName={name} decorative className="h-8 w-8" />
                  </PartyMark>
                  <span className="whitespace-nowrap">{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </SectionSettle>

      <SectionSettle>
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-96">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-xl border border-border bg-card py-2 pr-3 pl-10 leading-5 placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none sm:text-sm"
              placeholder="Søk i politikere"
            />
          </div>
          <div className="flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <ShieldCheck className="mr-2 h-4 w-4 text-brand" />
            <span>{filteredPolitikere.length} politikere</span>
          </div>
        </div>
      </SectionSettle>

      {showRegjeringSection ? (
        <SectionSettle>
          <section className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Landmark className="h-5 w-5 text-brand" />
                Regjeringen
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Statsminister, statsråder og regjeringsmedlemmer fra Stortingets åpne data.
              </p>
            </div>
            <TeamProfileGrid>
              {regjeringsmedlemmer.map((rep) => (
                <TeamProfileGridItem key={rep.id}>
                  <PolitikerCard rep={rep} />
                </TeamProfileGridItem>
              ))}
            </TeamProfileGrid>
          </section>
        </SectionSettle>
      ) : null}

      <SectionSettle>
        <div ref={listRef} className="scroll-mt-24 space-y-6" style={{ overflowAnchor: 'none' }}>
          {listedPolitikere.length === 0 && !showRegjeringSection ? (
            <EmptyState
              title="Ingen politikere matcher søket"
              description={
                selectedParty
                  ? `Ingen politikere funnet for ${selectedParty}${searchQuery.trim() ? ` som matcher «${searchQuery}»` : ''}.`
                  : `Ingen politikere funnet som matcher «${searchQuery}».`
              }
            />
          ) : listedPolitikere.length > 0 ? (
            <>
              <div ref={gridRef}>
                <TeamProfileGrid>
                  {pagedPolitikere.map((rep) => (
                    <TeamProfileGridItem key={rep.id}>
                      <PolitikerCard rep={rep} />
                    </TeamProfileGridItem>
                  ))}
                </TeamProfileGrid>
              </div>
              {totalPages > 1 ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    Viser {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, listedPolitikere.length)} av{' '}
                    {listedPolitikere.length}{' '}
                    {listedPolitikere.length === 1 ? 'politiker' : 'politikere'}
                  </p>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={changePage}
                    ariaLabel="Paginering for politikere"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </SectionSettle>
    </div>
  );
}
