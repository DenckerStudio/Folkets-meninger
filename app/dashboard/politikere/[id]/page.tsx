import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPolitikereOversikt } from '@/lib/stortinget';
import { getPolitikerProfileData } from '@/lib/politiker-profile-data';
import { buildPageMetadata, truncateDescription } from '@/lib/seo/metadata';
import PolitikerProfileShell from '@/components/politikere/politiker-profile-shell';

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
      'Se profil, roller og stemmer på Folkets Meninger.',
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const politikere = await getPolitikereOversikt();
  const rep = politikere.find((r) => String(r.id) === String(id));

  if (!rep) {
    notFound();
  }

  const profile = await getPolitikerProfileData(String(rep.id), rep);

  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">Laster profil…</div>}>
      <PolitikerProfileShell rep={rep} profile={profile} />
    </Suspense>
  );
}
