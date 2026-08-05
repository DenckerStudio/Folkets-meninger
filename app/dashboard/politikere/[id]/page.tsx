import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPolitikereOversikt } from '@/lib/stortinget';
import { getPolitikerProfileData } from '@/lib/politiker-profile-data';
import PolitikerProfileShell from '@/components/politikere/politiker-profile-shell';

export const dynamic = 'force-dynamic';

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
