import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import SporsmalList from '@/components/sporsmal/sporsmal-list';
import { SporsmalTypeTabs } from '@/components/sporsmal/sporsmal-type-tabs';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import { type SporsmalType } from '@/lib/stortinget';
import { buildHenvisningToSakIdIndex, resolveSporsmalSakId } from '@/lib/sporsmal/sak-link';
import { getSporsmalSearchText } from '@/lib/sporsmal/search-text';
import { loadSporsmalListe } from '@/lib/sporsmal/load';
import { getSakerWithCache } from '@/lib/stortinget-saker-cache';
import { routes } from '@/lib/routes';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';

export const revalidate = 3600;

export const metadata = buildPageMetadata({
  title: 'Skriftlige spørsmål fra Stortinget',
  description:
    'Les og søk i skriftlige spørsmål, interpellasjoner og spørretimespørsmål fra Stortingets åpne data. Filtrer på tema, parti og representant.',
  canonicalPath: '/dashboard/sporsmal',
  keywords: ['Stortinget', 'skriftlige spørsmål', 'interpellasjon', 'spørretime', 'politikk'],
});

function isSporsmalType(value: string | undefined): value is SporsmalType {
  return value === 'interpellasjoner' || value === 'skriftligesporsmal' || value === 'sporretimesporsmal';
}

function buildSakBySporsmalId(sporsmal: StortingetSporsmal[], henvisningIndex: Map<string, string>) {
  const out: Record<string, string | null> = {};
  for (const item of sporsmal) {
    if (item.id == null) continue;
    const key = String(item.id);
    out[key] = resolveSporsmalSakId(getSporsmalSearchText(item), henvisningIndex);
  }
  return out;
}

export default async function SporsmalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sesjonId?: string }>;
}) {
  const sp = await searchParams;
  const type: SporsmalType = isSporsmalType(sp.type) ? sp.type : 'skriftligesporsmal';
  const sesjonId = sp.sesjonId || STORTINGET_ACTIVE_SESSION_ID;

  const [{ ok, items }, saker] = await Promise.all([
    loadSporsmalListe({ type, sesjonId }),
    getSakerWithCache({ includeAll: false, preferDb: true }),
  ]);

  const sporsmal = items as StortingetSporsmal[];
  const henvisningIndex = buildHenvisningToSakIdIndex(
    saker.map((sak) => ({ id: sak.id, henvisning: sak.henvisning ?? null })),
  );
  const sakBySporsmalId = buildSakBySporsmalId(sporsmal, henvisningIndex);

  return (
    <DashboardPage>
      <FadeIn delay={0.1}>
        <PageHeader
          title="Spørsmål"
          description={`Søk, filtrer og les skriftlige spørsmål, spørretime og interpellasjoner fra Stortingets åpne data (${sesjonId}).`}
        />
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        {!ok ? (
          <EmptyState
            title="Klarte ikke å hente spørsmål"
            description="Stortingets åpne data svarer ikke akkurat nå. Prøv igjen om litt, eller utforsk saker i mellomtiden."
            tone="error"
            action={
              <Link
                href={routes.utforsk}
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Gå til Utforsk
              </Link>
            }
          />
        ) : sporsmal.length === 0 ? (
          <div className="space-y-6">
            <SporsmalTypeTabs activeType={type} sesjonId={sesjonId} />
            <EmptyState
              title="Ingen spørsmål for dette valget"
              description="Velg en annen spørsmålstype over, eller gå til Utforsk for å lese stortingssaker."
              action={
                <Link
                  href={routes.utforsk}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-brand hover:bg-muted"
                >
                  Gå til Utforsk
                </Link>
              }
            />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
                Laster filtre og liste…
              </div>
            }
          >
            <SporsmalList
              sporsmal={sporsmal}
              type={type}
              sesjonId={sesjonId}
              sakBySporsmalId={sakBySporsmalId}
            />
          </Suspense>
        )}
      </FadeIn>
    </DashboardPage>
  );
}