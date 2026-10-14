'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { LogIn, X } from 'lucide-react';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/interactive-menu';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  adminAccountNavItem,
  mobileMoreNavItems,
  mobileNavItems,
  type SiteNavLinkItem,
} from '@/lib/site-nav-links';
import { loginWithNext } from '@/lib/safe-redirect';
import { cn } from '@/lib/utils';

/**
 * Mobile/tablet bottom nav (< xl): Meninger · Utforsk · Avstemninger · Høringer · Mer.
 * «Mer» opens a sheet with Profil, Appens fremtid, Politikere, Kalender og Innsikt.
 * This is the only mobile navigation surface (the header hamburger is removed).
 */
export function MobileNav() {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMoreOpen(false);
  }

  const moreItems: SiteNavLinkItem[] = useMemo(() => {
    const items = mobileMoreNavItems.map((item) =>
      item.title === 'Profil' && !user
        ? { ...item, title: 'Logg inn', href: loginWithNext(pathname), icon: LogIn }
        : item,
    );
    return isAdminUser ? [...items, adminAccountNavItem] : items;
  }, [isAdminUser, pathname, user]);

  const items: InteractiveMenuItem[] = useMemo(
    () =>
      mobileNavItems.map((item) =>
        item.action === 'more'
          ? {
              label: item.label,
              href: item.href,
              icon: item.icon,
              isActive: (p: string) => moreItems.some((m) => m.isActive?.(p) ?? false),
              onClick: () => setMoreOpen((v) => !v),
              ariaExpanded: moreOpen,
            }
          : { label: item.label, href: item.href, icon: item.icon, isActive: item.isActive },
      ),
    [moreItems, moreOpen],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  return (
    <div className="xl:hidden">
      <AnimatePresence>
        {moreOpen ? (
          <div className="fixed inset-0 z-[49]" role="presentation">
            <motion.button
              type="button"
              aria-label="Lukk Mer"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMoreOpen(false)}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Mer"
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-background px-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl"
              initial={reducedMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={reducedMotion ? undefined : { y: '100%' }}
              transition={reducedMotion ? { duration: 0 } : { type: 'tween', duration: 0.24 }}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-foreground">Mer</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Lukk"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav aria-label="Mer" className="space-y-0.5">
                {moreItems.map((item) => {
                  const active = item.isActive?.(pathname) ?? false;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors',
                        active ? 'bg-brand/10 text-brand' : 'text-foreground/85 hover:bg-muted/70 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <InteractiveMenu items={items} accentColor="#00205b" />
    </div>
  );
}
