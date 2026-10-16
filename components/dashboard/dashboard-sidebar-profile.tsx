'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { ProfileMenuDropdown } from '@/components/profile/profile-menu-dropdown';
import { useAuth } from '@/hooks/use-auth';
import { loginWithNext } from '@/lib/safe-redirect';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type DashboardSidebarProfileProps = {
  onNavigate?: () => void;
  variant?: 'drawer' | 'desktop';
};

function ProfileMenuFallback() {
  return <div className="h-11 w-full animate-pulse rounded-xl bg-muted/60" aria-hidden />;
}

export function DashboardSidebarProfile({ onNavigate, variant = 'drawer' }: DashboardSidebarProfileProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const loginHref = loginWithNext(routes.utforsk);

  const handleSignOut = async () => {
    const { getBrowserSupabase } = await import('@/lib/supabase');
    await getBrowserSupabase().auth.signOut();
    onNavigate?.();
    router.push(routes.home);
    router.refresh();
  };

  const shellClass = cn(
    variant === 'drawer'
      ? 'border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]'
      : 'border-t border-border pt-2.5 mt-2',
  );

  if (loading) {
    return (
      <div className={shellClass}>
        <ProfileMenuFallback />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={shellClass}>
        <Link
          href={loginHref}
          onClick={onNavigate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/50"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden />
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {variant === 'drawer' ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Konto</p>
      ) : null}
      <Suspense fallback={<ProfileMenuFallback />}>
        <ProfileMenuDropdown
          onSignOut={handleSignOut}
          trigger="account"
          user={user}
          className="w-full min-w-0"
        />
      </Suspense>
    </div>
  );
}
