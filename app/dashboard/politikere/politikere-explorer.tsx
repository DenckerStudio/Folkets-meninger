'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { ShieldCheck, MapPin, Building2, Search, Landmark } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import type { PolitikerOversikt } from '@/lib/stortinget';
import { routes } from '@/lib/routes';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import { usePersistedState } from '@/hooks/use-persisted-state';

const partyLogos: Record<string, string> = {
  Arbeiderpartiet:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Arbeiderpartiet_logo.svg/200px-Arbeiderpartiet_logo.svg.png',
  Høyre:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/H%C3%B8yre_logo.svg/200px-H%C3%B8yre_logo.svg.png',
  Senterpartiet:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Senterpartiet_logo.svg/200px-Senterpartiet_logo.svg.png',
  Fremskrittspartiet:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Fremskrittspartiet_logo.svg/200px-Fremskrittspartiet_logo.svg.png',
  'Sosialistisk Venstreparti':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Sosialistisk_Venstreparti_logo.svg/200px-Sosialistisk_Venstreparti_logo.svg.png',
  Rødt:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/R%C3%B8dt_logo.svg/200px-R%C3%B8dt_logo.svg.png',
  Venstre:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Venstre_logo.svg/200px-Venstre_logo.svg.png',
  'Kristelig Folkeparti':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Kristelig_Folkeparti_logo.svg/200px-Kristelig_Folkeparti_logo.svg.png',
  'Miljøpartiet De Grønne':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Milj%C3%B8partiet_De_Gr%C3%B8nne_logo.svg/200px-Milj%C3%B8partiet_De_Gr%C3%B8nne_logo.svg.png',
  Pasientfokus:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Pasientfokus_logo.png/200px-Pasientfokus_logo.png',
};

function getPartyColor(partyName: string) {
  const colors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    Arbeiderpartiet: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-red-100', icon: 'bg-red-600' },
    Høyre: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', icon: 'bg-blue-600' },
    Senterpartiet: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', icon: 'bg-green-600' },
    Fremskrittspartiet: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-100 dark:border-indigo-900/50',
      icon: 'bg-indigo-900',
    },
    'Sosialistisk Venstreparti': {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-100',
      icon: 'bg-rose-600',
    },
    Rødt: { bg: 'bg-destructive/10', text: 'text-red-800', border: 'border-destructive/30', icon: 'bg-red-700' },
    Venstre: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: 'bg-emerald-600' },
    'Kristelig Folkeparti': {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-100',
      icon: 'bg-yellow-500',
    },
    'Miljøpartiet De Grønne': {
      bg: 'bg-lime-50',
      text: 'text-lime-700',
      border: 'border-lime-100',
      icon: 'bg-lime-600',
    },
    Pasientfokus: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: 'bg-orange-500' },
  };

  return colors[partyName] || { bg: 'bg-muted/40', text: 'text-foreground', border: 'border-border', icon: 'bg-muted/400' };
}

function PolitikerCard({ rep, index }: { rep: PolitikerOversikt; index: number }) {
  const partyColors = getPartyColor(rep.parti.navn);
  const roleLabel = rep.tittel || 'Stortingsrepresentant';

  return (
    <FadeIn delay={0.1 * Math.min(index, 8)} direction="up">
      <Link
        href={routes.politiker(String(rep.id))}
        className="group bg-card rounded-2xl shadow-sm border border-border hover:shadow-lg hover:border-border transition-all duration-200 flex flex-col h-full overflow-hidden"
      >
        <div className={`h-2 w-full ${partyColors.icon}`} />
        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-start justify-between mb-5">
            <div className="relative w-14 h-14 rounded-2xl shadow-sm overflow-hidden border border-border group-hover:scale-105 transition-transform duration-200 bg-muted/40">
              <Image
                src={getPersonbildeUrl(rep.id, 'lite', true)}
                alt={`${rep.fornavn} ${rep.etternavn}`}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            {rep.erRegjeringsmedlem ? (
              <div className="flex items-center bg-amber-50 dark:bg-amber-950/40 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-100 shadow-sm max-w-[120px]">
                <Landmark className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">{roleLabel}</span>
              </div>
            ) : (
              <div className="flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-100 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Representant
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-bold text-foreground leading-tight mb-1 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">
              {rep.fornavn} {rep.etternavn}
            </h3>
            <p className="text-sm font-medium text-muted-foreground">{roleLabel}</p>
          </div>

          <div className="mt-auto pt-5 border-t border-border space-y-3">
            <div className="flex items-center text-sm">
              <div
                className={`w-6 h-6 rounded-full ${partyColors.bg} flex items-center justify-center mr-3 flex-shrink-0 overflow-hidden relative`}
              >
                {partyLogos[rep.parti.navn] ? (
                  <Image
                    src={partyLogos[rep.parti.navn]}
                    alt={`${rep.parti.navn} logo`}
                    fill
                    className="object-contain p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Building2 className={`w-3.5 h-3.5 ${partyColors.text}`} />
                )}
              </div>
              <span className="font-medium text-foreground">{rep.parti.navn}</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center mr-3 flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="text-muted-foreground">{rep.departement || rep.fylke.navn}</span>
            </div>
          </div>
        </div>
      </Link>
    </FadeIn>
  );
}

type PolitikereExplorerProps = {
  politikere: PolitikerOversikt[];
};

function isSearchString(value: unknown): value is string {
  return typeof value === 'string';
}

export default function PolitikereExplorer({ politikere }: PolitikereExplorerProps) {
  const [searchQuery, setSearchQuery] = usePersistedState(
    PREFERENCE_KEYS.politikere.search,
    '',
    isSearchString
  );

  const regjeringsmedlemmer = useMemo(
    () =>
      politikere
        .filter((p) => p.erRegjeringsmedlem)
        .sort((a, b) => (a.regjeringsSortering ?? 999) - (b.regjeringsSortering ?? 999)),
    [politikere]
  );

  const filteredPolitikere = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = query
      ? politikere.filter(
          (rep) =>
            rep.fornavn.toLowerCase().includes(query) ||
            rep.etternavn.toLowerCase().includes(query) ||
            rep.parti.navn.toLowerCase().includes(query) ||
            rep.fylke.navn.toLowerCase().includes(query) ||
            (rep.tittel?.toLowerCase().includes(query) ?? false) ||
            (rep.departement?.toLowerCase().includes(query) ?? false)
        )
      : politikere;

    return [...base].sort((a, b) => a.etternavn.localeCompare(b.etternavn, 'no'));
  }, [politikere, searchQuery]);

  const showRegjeringSection = !searchQuery.trim() && regjeringsmedlemmer.length > 0;

  const listedPolitikere = useMemo(() => {
    if (!showRegjeringSection) return filteredPolitikere;
    const regjeringsIds = new Set(regjeringsmedlemmer.map((p) => p.id));
    return filteredPolitikere.filter((p) => !regjeringsIds.has(p.id));
  }, [filteredPolitikere, regjeringsmedlemmer, showRegjeringSection]);

  return (
    <>
      <FadeIn delay={0.2} direction="up">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-xl leading-5 bg-card placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              placeholder="Søk etter navn, parti, rolle eller fylke..."
            />
          </div>
          <div className="flex items-center text-sm text-muted-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span>{filteredPolitikere.length} politikere</span>
          </div>
        </div>
      </FadeIn>

      {showRegjeringSection && (
        <FadeIn delay={0.25} direction="up">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Regjeringen
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Statsminister, statsråder og regjeringsmedlemmer fra Stortingets åpne data.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regjeringsmedlemmer.map((rep, index) => (
                <PolitikerCard key={rep.id} rep={rep} index={index} />
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      <FadeIn delay={0.3} direction="up">
        {listedPolitikere.length === 0 && !showRegjeringSection ? (
          <div className="text-center py-12 text-muted-foreground">
            Ingen politikere funnet som matcher &quot;{searchQuery}&quot;.
          </div>
        ) : listedPolitikere.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listedPolitikere.map((rep, index) => (
              <PolitikerCard key={rep.id} rep={rep} index={index} />
            ))}
          </div>
        ) : null}
      </FadeIn>
    </>
  );
}
