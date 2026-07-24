'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bell, ChevronDown, Eye, LogIn, LogOut, Settings, SlidersHorizontal, UserCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import { isDashboardPath, isPublicProfilePath, routes } from '@/lib/routes';
import { DashboardNavMenuButton } from '@/components/dashboard/dashboard-nav-context';

export function Header() {
  const scrolled = useScroll(10);
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const inDashboard = isDashboardPath(pathname);
  const isLoggedIn = !!user;
  const [unreadCount, setUnreadCount] = React.useState(0);
  const displayUnreadCount = isLoggedIn ? unreadCount : 0;
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const initials = initialsFromDisplayName(displayName || user?.email || 'FS');
  const logoHref = isPublicProfilePath(pathname)
    ? routes.home
    : isLoggedIn
      ? routes.forum
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
            <DashboardNavMenuButton className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background text-gray-700 transition-colors hover:bg-accent hover:text-accent-foreground xl:hidden" />
          ) : null}
          {isLoggedIn ? (
            <details className={cn('group relative', inDashboard && 'hidden xl:block')}>
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00205b] text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-28 truncate sm:inline">
                  {displayName?.split(' ')[0] || 'Profil'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{displayName || 'Min konto'}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                </div>
                <div className="p-2">
                  <ProfileMenuLink href={routes.minSide} icon={UserCircle} title="Min side" description="Stemmehistorikk og oversikt" />
                  <ProfileMenuLink href={routes.profile(user!.id)} icon={Eye} title="Offentlig profil" description="Slik andre ser deg" />
                  <ProfileMenuLink href={`${routes.minSide}?tab=offentlig`} icon={Settings} title="Profilinnstillinger" description="Bio, parti og poengdeling" />
                  <ProfileMenuLink href={`${routes.minSide}?tab=preferanser`} icon={SlidersHorizontal} title="Preferanser" description="Utseende, animasjoner og hjelp" />
                  <ProfileMenuLink href={`${routes.minSide}?tab=varsler`} icon={Bell} title="Varsler" description="E-post og varsler" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logg ut
                  </button>
                </div>
              </div>
            </details>
          ) : (
            <>
              <Button variant="outline" render={<Link href={routes.login} />}>
                <LogIn className="size-4" />
                Logg inn
              </Button>
              <Button render={<Link href={routes.login} />} className="hidden sm:inline-flex">Kom i gang</Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

type ProfileMenuLinkProps = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

function ProfileMenuLink({ href, icon: Icon, title, description }: ProfileMenuLinkProps) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
    </Link>
  );
}

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
        <span className="text-[#00205b] text-[0.65rem] leading-none sm:text-sm">FOLKETS</span>
        <span className="text-[#ba0c2f] text-[0.65rem] leading-none sm:text-sm">STEMME</span>
      </div>
    </div>
  );
}
