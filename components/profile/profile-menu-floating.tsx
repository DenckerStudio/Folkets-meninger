'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { ProfileMenuDropdown } from '@/components/profile/profile-menu-dropdown';

function ProfileMenuFloatingFallback() {
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-popover shadow-lg"
      aria-hidden
    />
  );
}

export function ProfileMenuFloating() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleSignOut = async () => {
    const { getBrowserSupabase } = await import('@/lib/supabase');
    await getBrowserSupabase().auth.signOut();
    router.push(routes.home);
    router.refresh();
  };

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-40 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-hidden={false}
    >
      <div className="pointer-events-auto">
        <Suspense fallback={<ProfileMenuFloatingFallback />}>
          <ProfileMenuDropdown
            onSignOut={handleSignOut}
            className="[&_button]:h-12 [&_button]:w-12 [&_button]:rounded-full [&_button]:border-border [&_button]:bg-card [&_button]:shadow-lg"
          />
        </Suspense>
      </div>
    </div>
  );
}
