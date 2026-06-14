import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ProfileShell } from '@/components/profile/profile-shell';
import { routes } from '@/lib/routes';

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function MinSidePage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.tab === 'mine-innlegg') {
    redirect(routes.forumMineInnlegg);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Laster…</div>}>
      <ProfileShell />
    </Suspense>
  );
}
