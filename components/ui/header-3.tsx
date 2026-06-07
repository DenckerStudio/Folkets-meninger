'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { NavLink, NavMenuLink, useNavSectionActive } from '@/components/ui/nav-link';
import { BarChart2, Bell, Flag, LogIn, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import {
  desktopMoreNavLinks,
  desktopPrimaryNavLinks,
  isAdminActive,
} from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';

export function Header() {
  const scrolled = useScroll(10);
  const { user } = useAuth();
  const router = useRouter();
  const isLoggedIn = !!user;
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isForumAdmin, setIsForumAdmin] = React.useState(false);
  const showForumAdmin = isLoggedIn && isForumAdmin;
  const displayUnreadCount = isLoggedIn ? unreadCount : 0;
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const moreSectionActive = useNavSectionActive([
    ...desktopMoreNavLinks.flatMap((item) => (item.isActive ? [item.isActive] : [])),
    ...(showForumAdmin ? [isAdminActive] : []),
  ]);

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
    timer = window.setInterval(load, 30000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isLoggedIn]);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((json) => setIsForumAdmin(!!json.admin))
      .catch(() => setIsForumAdmin(false));
  }, [isLoggedIn]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/80',
        scrolled ? 'border-border shadow-sm backdrop-blur-lg' : 'border-border/60',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 md:gap-5">
          <Link href={routes.utforsk} className="hover:opacity-90 rounded-md p-1 transition-opacity">
            <FolketsStemmeLogo />
          </Link>
          <div className="hidden items-center gap-0.5 md:flex">
            {desktopPrimaryNavLinks.map((item) => (
              <NavLink key={item.href} href={item.href} isActive={item.isActive}>
                {item.label}
              </NavLink>
            ))}
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={cn(
                      'bg-transparent',
                      moreSectionActive && 'text-[#00205b]',
                    )}
                  >
                    Mer
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="bg-background p-1 pr-1.5">
                    <ul className="bg-popover w-72 space-y-1 rounded-md border p-2 shadow">
                      {showForumAdmin ? (
                        <>
                          <li className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Admin
                          </li>
                          <li>
                            <NavMenuLink
                              title="Rapporter"
                              description="Forum-meldinger og moderering"
                              icon={Flag}
                              href={routes.adminForumReports}
                              isActive={isAdminActive}
                            />
                          </li>
                          <li>
                            <NavMenuLink
                              title="Statistikk"
                              description="Eksport og oversikt"
                              icon={BarChart2}
                              href={routes.adminStats}
                              isActive={isAdminActive}
                            />
                          </li>
                          <li>
                            <NavMenuLink
                              title="Forum Reels"
                              description="Pipeline fra nyhetssak til publisering"
                              icon={Sparkles}
                              href={`${routes.adminForumPrompts}?tab=pipeline`}
                              isActive={isAdminActive}
                            />
                          </li>
                          <li className="my-1 border-t border-border" aria-hidden />
                        </>
                      ) : null}
                      {desktopMoreNavLinks.map((item) => (
                        <li key={item.href}>
                          <NavMenuLink {...item} />
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {isLoggedIn ? (
            <>
              <Link
                href={routes.varsler}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label="Varsler"
              >
                <Bell className="size-4" />
                {displayUnreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                    {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
                  </span>
                ) : null}
              </Link>
              <Button variant="outline" render={<Link href={routes.minSide} />}>
                {displayName ? `Hei, ${displayName.split(' ')[0]}` : 'Min side'}
              </Button>
              <Button onClick={handleSignOut}>
                <LogOut className="size-4" />
                Logg ut
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" render={<Link href={routes.login} />}>
                <LogIn className="size-4" />
                Logg inn
              </Button>
              <Button render={<Link href={routes.login} />}>Kom i gang</Button>
            </>
          )}
        </div>
      </nav>
    </header>
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
      <div className="hidden flex-col justify-center font-extrabold tracking-tight sm:flex">
        <span className="text-[#00205b] text-sm leading-none">FOLKETS</span>
        <span className="text-[#ba0c2f] text-sm leading-none">STEMME</span>
      </div>
    </div>
  );
}
