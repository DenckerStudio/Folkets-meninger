'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bell, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { isDashboardPath, isPublicProfilePath, routes } from '@/lib/routes';
import { desktopPrimaryNavLinks } from '@/lib/site-nav-links';
import { DashboardNavMenuButton } from '@/components/dashboard/dashboard-nav-context';
import { ProfileMenuDropdown } from '@/components/profile/profile-menu-dropdown';

export function Header() {
  const scrolled = useScroll(10);
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const inDashboard = isDashboardPath(pathname);
  const isLoggedIn = !!user;
  const [unreadCount, setUnreadCount] = React.useState(0);
  const displayUnreadCount = isLoggedIn ? unreadCount : 0;
  const logoHref = isPublicProfilePath(pathname)
    ? routes.home
    : isLoggedIn
      ? routes.utforsk
      : routes.home;
  const handleSignOut = async () => {
    const { getBrowserSupabase } = await import('@/lib/supabase');
    await getBrowserSupabase().auth.signOut();
    router.push(routes.home);
    router.refresh();
  };

  React.useEffect(() => {
    if (!isLoggedIn) return;

    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
        const json = await res.json();
        setUnreadCount(Number(json.count || 0));
      } catch {
        // ignore
      }
    };

    void load();
    timer = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isLoggedIn]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 pt-[env(safe-area-inset-top,0px)] supports-[backdrop-filter]:bg-background/80',
        scrolled ? 'border-border shadow-sm backdrop-blur-lg' : 'border-border/60',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href={logoHref} className="rounded-md p-1 transition-opacity hover:opacity-90" aria-label="Gå til forsiden">
            <FolketsStemmeLogo />
          </Link>
          {!inDashboard ? (
            <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Hovedmeny">
              {desktopPrimaryNavLinks.map((link) => {
                const active = link.isActive(pathname ?? '');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand/10 text-brand'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={isLoggedIn ? routes.varsler : routes.login}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Varsler"
          >
            <Bell className="size-4" />
            {displayUnreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
              </span>
            ) : null}
          </Link>
          {inDashboard ? (
            <DashboardNavMenuButton className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground xl:hidden" />
          ) : null}
          {isLoggedIn ? (
            <div className={cn(inDashboard && 'hidden xl:block')}>
              <Suspense fallback={<ProfileMenuDropdownFallback />}>
                <ProfileMenuDropdown onSignOut={handleSignOut} />
              </Suspense>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" className="sm:h-8" render={<Link href={routes.login} />}>
                <LogIn className="size-3.5 sm:size-4" />
                <span className="hidden min-[380px]:inline">Logg inn</span>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex sm:h-8" render={<Link href={routes.login} />}>
                Kom i gang
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function ProfileMenuDropdownFallback() {
  return (
    <div
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-popover"
      aria-hidden
    />
  );
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  React.useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}

function FolketsStemmeLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 200 250" className="h-10 w-8 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <clipPath id="fs-nav-bubble">
          <path d="M 40 0 H 160 A 40 40 0 0 1 200 40 V 160 A 40 40 0 0 1 160 200 H 140 L 145 240 L 100 200 H 40 A 40 40 0 0 1 0 160 V 40 A 40 40 0 0 1 40 0 Z" />
        </clipPath>
        <g clipPath="url(#fs-nav-bubble)">
          <rect width="200" height="250" fill="#ba0c2f" />
          <rect x="60" y="0" width="30" height="250" fill="white" />
          <rect x="0" y="80" width="200" height="30" fill="white" />
          <rect x="70" y="0" width="10" height="250" fill="#00205b" />
          <rect x="0" y="90" width="200" height="10" fill="#00205b" />
          <path d="M 0 150 L 90 60 L 120 90 L 220 -10 L 220 250 L 0 250 Z" fill="#ba0c2f" />
          <path
            d="M -10 160 L 90 60 L 120 90 L 230 -20"
            fill="none"
            stroke="white"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="120" cy="90" r="14" fill="#00205b" stroke="white" strokeWidth="6" />
        </g>
      </svg>
      <div className="flex flex-col justify-center font-extrabold tracking-tight">
        <span className="text-brand text-[0.65rem] leading-none sm:text-sm">FOLKETS</span>
        <span className="text-brand-accent text-[0.65rem] leading-none sm:text-sm">STEMME</span>
      </div>
    </div>
  );
}
