import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPolitikereOversikt } from '@/lib/stortinget';
import { getPolitikerProfileData } from '@/lib/politiker-profile-data';
import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';
import PolitikerProfileShell from '@/components/politikere/politiker-profile-shell';
import { isPolitikerTabId } from '@/components/politikere/politiker-tabs';
import { PolitikerStemmerServerPanel } from '@/components/politikere/politiker-stemmer-server-panel';
import { PolitikerStemmerLoading } from '@/components/politikere/politiker-stemmer-loading';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const politikere = await getPolitikereOversikt().catch(() => []);
  const rep = politikere.find((r) => String(r.id) === String(id));

  if (!rep) {
    return buildPageMetadata({
      title: 'Politiker ikke funnet',
      description: 'Fant ikke politikeren i Stortingets åpne data.',
      canonicalPath: `/dashboard/politikere/${id}`,
      robots: { index: false, follow: false },
    });
  }

  const name = [rep.fornavn, rep.etternavn].filter(Boolean).join(' ').trim();
  const role = rep.erRegjeringsmedlem ? rep.tittel : 'Stortingsrepresentant';
  const description = truncateDescription(
    [
      partyLine(name, rep.parti?.navn),
      role,
      rep.fylke?.navn,
      'Se profil, roller, voteringer og hva brukerne mener på Folkets Meninger.',
    ]
      .filter(Boolean)
      .join(' '),
  );

  return buildPageMetadata({
    title: name,
    description,
    canonicalPath: `/dashboard/politikere/${id}`,
    openGraphType: 'profile',
  });
}

function partyLine(name: string, party?: string | null): string {
  return party ? `${name} (${party})` : name;
}

export default async function PolitikerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const activeTab = isPolitikerTabId(tabParam ?? null) ? tabParam! : 'oversikt';
  const politikere = await getPolitikereOversikt();
  const rep = politikere.find((r) => String(r.id) === String(id));

  if (!rep) {
    notFound();
  }

  const profile = await getPolitikerProfileData(String(rep.id), rep);
  const stemmerSaker =
    profile.allSaker.length > 0
      ? profile.allSaker
      : [...profile.broughtUpSaker, ...profile.saksordfoererSaker];

  const stemmerContent =
    activeTab === 'stemmer' ? (
      <Suspense fallback={<PolitikerStemmerLoading />}>
        <PolitikerStemmerServerPanel rep={rep} saker={stemmerSaker} />
      </Suspense>
    ) : null;

  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">Laster profil…</div>}>
      <PolitikerProfileShell rep={rep} profile={profile} stemmerContent={stemmerContent} />
    </Suspense>
  );
}
