'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  FileText,
  Info,
  Landmark,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { getPersonbildeUrl } from '@/lib/stortinget-utils';
import type { PolitikerOversikt } from '@/lib/stortinget';
import type { PolitikerProfileData, PolitikerSakItem, PolitikerSporsmalItem } from '@/lib/politiker-profile-data';
import { POLITIKER_TABS, isPolitikerTabId, type PolitikerTabId } from '@/components/politikere/politiker-tabs';
import { SAK_CATEGORY_BADGE_CLASS } from '@/lib/sak-status';
import { getSakKindLabel, type SakKind } from '@/lib/stortinget-sak-presentation';
import { BackButton } from '@/components/dashboard/back-button';
import { PoliticianResponseList } from '@/components/politikere/politician-response-dialog';
import { getPolitikerRolleInfo } from '@/lib/politiker-roller';

type PolitikerProfileShellProps = {
  rep: PolitikerOversikt;
  profile: PolitikerProfileData;
};

function resolveTab(tabParam: string | null): PolitikerTabId {
  if (isPolitikerTabId(tabParam)) return tabParam;
  return 'oversikt';
}

function SakList({ saker, emptyMessage }: { saker: PolitikerSakItem[]; emptyMessage: string }) {
  if (saker.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {saker.map((sak) => (
        <Link
          key={`${sak.role}-${sak.id}`}
          href={routes.sak(sak.id)}
          className="block rounded-2xl border border-border bg-card p-4 hover:border-indigo-100 dark:border-indigo-900/50 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground line-clamp-2">{sak.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {sak.category ? (
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', SAK_CATEGORY_BADGE_CLASS)}>
                    {sak.category}
                  </span>
                ) : null}
                {sak.sakKind === 'lovforslag' || sak.sakKind === 'representantforslag' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground">
                    {getSakKindLabel(sak.sakKind as SakKind)}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground capitalize">{sak.status === 'open' ? 'Åpen' : 'Avsluttet'}</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function SporsmalList({ items, emptyMessage }: { items: PolitikerSporsmalItem[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={`${item.type}-${item.id}`}
          href={routes.sporsmalDetail(item.id)}
          className="block rounded-xl border border-border bg-muted/40 p-4 hover:bg-card hover:border-border transition-colors"
        >
          <div className="text-sm font-medium text-foreground line-clamp-2">{item.title}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{item.typeLabel}</span>
            {item.date ? <span>· {item.date}</span> : null}
            {item.counterparty ? <span>· {item.counterparty}</span> : null}
          </div>
          {item.emner.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.emner.slice(0, 3).map((emne) => (
                <span key={emne} className="text-xs bg-card border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                  {emne}
                </span>
              ))}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function OverviewPanel({ rep, profile }: PolitikerProfileShellProps) {
  const totalSaker = profile.broughtUpSaker.length + profile.saksordfoererSaker.length;
  const topTopics = profile.topicStats.slice(0, 5);
  const rolleInfo = getPolitikerRolleInfo(rep.tittel, rep.erRegjeringsmedlem);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{profile.broughtUpSaker.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Representantforslag</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{profile.saksordfoererSaker.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Som saksordfører</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{profile.sporsmalFra.length + profile.sporsmalTil.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Spørsmål i sesjonen</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{profile.officialResponses.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Offisielle svar her</div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-950/40/50 p-5">
        <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Om rollen: {rolleInfo.title}
        </h2>
        <p className="text-sm text-indigo-900/90 mt-2 leading-relaxed">{rolleInfo.description}</p>
      </div>

      {rep.erRegjeringsmedlem ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 dark:bg-amber-950/40 p-5">
          <h2 className="font-semibold text-amber-900 flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            I regjeringen nå
          </h2>
          <p className="text-sm text-amber-800 mt-2">
            {rep.fornavn} {rep.etternavn} sitter i regjeringen som {rep.tittel?.toLowerCase() ?? 'statsråd'}
            {rep.departement ? ` (${rep.departement})` : ''}. Lovforslag fra regjeringen vises ikke som personlige
            representantforslag, men spørsmål til {rep.tittel?.toLowerCase() ?? 'vedkommende'} listes under spørsmål.
          </p>
        </div>
      ) : null}

      {totalSaker === 0 && !rep.erRegjeringsmedlem ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          Vi fant ingen registrerte representantforslag eller saksordførerroller for denne perioden i Stortingets åpne data.
        </div>
      ) : null}

      {topTopics.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <Tags className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Mest involverte temaer
          </h2>
          <div className="space-y-3">
            {topTopics.map((topic) => (
              <div key={topic.name} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground truncate">{topic.name}</span>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">{topic.count} saker</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {profile.officialResponses.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Nylige offisielle svar</h2>
          <PoliticianResponseList rep={rep} responses={profile.officialResponses.slice(0, 3)} />
        </div>
      ) : null}

      {profile.broughtUpSaker.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Nylige forslag</h2>
          <SakList saker={profile.broughtUpSaker.slice(0, 5)} emptyMessage="" />
        </div>
      ) : null}

      {(profile.sporsmalFra.length > 0 || profile.sporsmalTil.length > 0) && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <h2 className="font-semibold text-foreground">Spørsmål i inneværende stortingssesjon</h2>
          {profile.sporsmalFra.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Stilt av politikeren</h3>
              <SporsmalList items={profile.sporsmalFra.slice(0, 3)} emptyMessage="" />
            </div>
          ) : null}
          {profile.sporsmalTil.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Stilt til politikeren</h3>
              <SporsmalList items={profile.sporsmalTil.slice(0, 3)} emptyMessage="" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function PolitikerProfileShell({ rep, profile }: PolitikerProfileShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = resolveTab(searchParams.get('tab'));
  const roleLabel = rep.tittel || 'Stortingsrepresentant';
  const locationLabel = rep.departement || rep.fylke.navn;
  const rolleInfo = getPolitikerRolleInfo(rep.tittel, rep.erRegjeringsmedlem);

  const setTab = (tab: PolitikerTabId) => {
    router.replace(`${routes.politiker(String(rep.id))}?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <BackButton fallbackHref={routes.politikere} />

      <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-border shrink-0">
            <Image
              src={getPersonbildeUrl(rep.id, 'stort', true)}
              alt={`${rep.fornavn} ${rep.etternavn}`}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">
                {rep.fornavn} {rep.etternavn}
              </h1>
              {profile.isPlatformVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verifisert på Folkets Stemme
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
              {rep.erRegjeringsmedlem ? <Landmark className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : null}
              {roleLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {rep.parti.navn}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {locationLabel}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">{rolleInfo.description}</p>
            <Link
              href={routes.forum}
              className="inline-flex mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              Diskuter i forum →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8">
        <nav className="space-y-1" aria-label="Politikerseksjoner">
          {POLITIKER_TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className="font-medium block">{tab.label}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activeTab === 'oversikt' ? <OverviewPanel rep={rep} profile={profile} /> : null}

          {activeTab === 'forslag' ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Forslag politikeren har brakt opp
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Representantforslag der {rep.fornavn} {rep.etternavn} står som forslagstiller i Stortingets data.
              </p>
              <SakList
                saker={profile.broughtUpSaker}
                emptyMessage="Ingen representantforslag registrert for denne politikeren i inneværende periode."
              />
            </section>
          ) : null}

          {activeTab === 'saksordfoerer' ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Saker som saksordfører
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Saker der {rep.fornavn} {rep.etternavn} er utpekt som saksordfører for komiteen.
              </p>
              <SakList
                saker={profile.saksordfoererSaker}
                emptyMessage="Ingen saksordførerroller funnet i Stortingets data for denne perioden."
              />
            </section>
          ) : null}

          {activeTab === 'temaer' ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Tags className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Temaer med mest involvering
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Fordeling basert på kategorier i saker der politikeren er forslagstiller eller saksordfører.
              </p>
              {profile.topicStats.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Ingen temaer å vise ennå.</p>
              ) : (
                <div className="space-y-4">
                  {profile.topicStats.map((topic, index) => {
                    const max = profile.topicStats[0]?.count ?? 1;
                    const width = Math.max(8, Math.round((topic.count / max) * 100));
                    return (
                      <div key={topic.name}>
                        <div className="flex justify-between text-sm mb-1.5 gap-3">
                          <span className="font-medium text-foreground truncate">{topic.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{topic.count} saker</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-50 dark:bg-indigo-950/400"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        {index === 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">Mest aktivt tema i perioden</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'svar' ? (
            <section className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Offisielle svar på Folkets Stemme
                </h2>
                <p className="text-sm text-muted-foreground">
                  Svar publisert av verifiserte politikere direkte på saker i appen.
                </p>
              </div>

              {profile.officialResponses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {profile.isPlatformVerified
                    ? 'Ingen offisielle svar publisert ennå.'
                    : 'Politikeren har ikke verifisert seg på plattformen, eller har ikke publisert svar ennå.'}
                </p>
              ) : (
                <PoliticianResponseList rep={rep} responses={profile.officialResponses} />
              )}

              {(profile.sporsmalFra.length > 0 || profile.sporsmalTil.length > 0) && (
                <div className="border-t border-border pt-6">
                  <h3 className="font-semibold text-foreground mb-4">Spørsmål fra Stortinget</h3>
                  {profile.sporsmalFra.length > 0 ? (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-foreground mb-3">Stilt av politikeren</h4>
                      <SporsmalList items={profile.sporsmalFra} emptyMessage="" />
                    </div>
                  ) : null}
                  {profile.sporsmalTil.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-3">Stilt til politikeren</h4>
                      <SporsmalList items={profile.sporsmalTil} emptyMessage="" />
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
