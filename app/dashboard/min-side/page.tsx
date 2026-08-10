import { Suspense } from 'react';
import { ProfileShell } from '@/components/profile/profile-shell';

export default async function MinSidePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Laster…</div>}>
      <ProfileShell />
    </Suspense>
  );
}
