'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, MapPin, Search, Landmark, ShieldCheck } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { PartyLogo } from '@/components/politikere/party-logo';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import type { PolitikerOversikt } from '@/lib/stortinget';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { missingPartyLogos, uniquePartyNames } from '@/lib/party-logos';
import { cn } from '@/lib/utils';

function PolitikerCard({ rep, index }: { rep: PolitikerOversikt; index: number }) {
  const roleLabel = rep.tittel || 'Stortingsrepresentant';
  const locationLabel = rep.departement || rep.fylke.navn;

  return (
    <FadeIn delay={0.1 * Math.min(index, 8)} direction="up">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <Link href={routes.politiker(String(rep.id))} className="group block min-w-0 flex-1 p-6 pb-4">
          <div className="mb-4 flex items-start justify-between gap-3">
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
              <span className="inline-flex max-w-[9rem] items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                <Landmark className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{roleLabel}</span>
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
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

        <div className="flex flex-col justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:items-center">
          <Link
            href={routes.parti(rep.parti.navn)}
            className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground hover:text-brand"
          >
            <PartyLogo partyName={rep.parti.navn} className="h-8 w-8 shrink-0" />
            <span className="truncate">{rep.parti.navn}</span>
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
    </FadeIn>
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

export default function PolitikereExplorer({ politikere }: PolitikereExplorerProps) {
  const searchParams = useSearchParams();
  const selectedParty = searchParams.get('parti');
  const [searchQuery, setSearchQuery] = usePersistedState(
    PREFERENCE_KEYS.politikere.search,
    '',
    isSearchString
  );

  const partyNames = useMemo(
    () => uniquePartyNames(politikere.map((rep) => rep.parti.navn)),
    [politikere]
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
    [filteredPolitikere]
  );

  const showRegjeringSection = !searchQuery.trim() && !selectedParty && regjeringsmedlemmer.length > 0;

  const listedPolitikere = useMemo(() => {
    if (!showRegjeringSection) return filteredPolitikere;
    const regjeringsIds = new Set(regjeringsmedlemmer.map((p) => p.id));
    return filteredPolitikere.filter((p) => !regjeringsIds.has(p.id));
  }, [filteredPolitikere, regjeringsmedlemmer, showRegjeringSection]);

  if (missingLogos.length > 0) {
    return (
      <p className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        Mangler partilogo for: {missingLogos.join(', ')}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <FadeIn delay={0.15} direction="up">
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
                    'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-card text-foreground hover:border-brand/40'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <PartyLogo partyName={name} decorative className="h-8 w-8" />
                  <span>{name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
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
              placeholder="Søk etter navn, parti, rolle eller fylke..."
            />
          </div>
          <div className="flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <ShieldCheck className="mr-2 h-4 w-4 text-brand" />
            <span>{filteredPolitikere.length} politikere</span>
          </div>
        </div>
      </FadeIn>

      {showRegjeringSection && (
        <FadeIn delay={0.25} direction="up">
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {regjeringsmedlemmer.map((rep, index) => (
                <PolitikerCard key={rep.id} rep={rep} index={index} />
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      <FadeIn delay={0.3} direction="up">
        {listedPolitikere.length === 0 && !showRegjeringSection ? (
          <div className="py-12 text-center text-muted-foreground">
            {selectedParty
              ? `Ingen politikere funnet for ${selectedParty}${searchQuery.trim() ? ` som matcher "${searchQuery}"` : ''}.`
              : `Ingen politikere funnet som matcher "${searchQuery}".`}
          </div>
        ) : listedPolitikere.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listedPolitikere.map((rep, index) => (
              <PolitikerCard key={rep.id} rep={rep} index={index} />
            ))}
          </div>
        ) : null}
      </FadeIn>
    </div>
  );
}
