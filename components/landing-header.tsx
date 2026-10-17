'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { LandingLogo } from '@/components/landing-logo';
import { FlagStripe } from '@/components/motion/flag-stripe';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { touchTargetLinkClass } from '@/lib/touch-target';
import { useAuth } from '@/hooks/use-auth';

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

export function LandingHeader() {
  const scrolled = useScroll(10);
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full bg-white/95 pt-[env(safe-area-inset-top,0px)] supports-[backdrop-filter]:bg-white/85',
        scrolled ? 'shadow-sm backdrop-blur-lg' : '',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={routes.home}
          aria-label="Gå til forsiden"
          className="rounded-md p-1 transition-opacity hover:opacity-90"
        >
          <LandingLogo clipId="fs-header-bubble" animate={pathname === '/'} />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <a
            href={routes.omOss}
            onClick={(event) => {
              if (window.location.pathname !== '/') return;
              event.preventDefault();
              document.getElementById('om-oss')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              window.history.replaceState(null, '', '/#om-oss');
            }}
            className={cn(
              'hidden sm:inline-flex px-3 text-sm font-medium text-[#001433]/65 transition-colors hover:text-[#ba0c2f]',
              touchTargetLinkClass,
            )}
          >
            Om oss
          </a>
          {user ? (
            <Link
              href={routes.dashboard}
              className={cn(
                touchTargetLinkClass,
                'justify-center rounded-full bg-[#00205b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]',
              )}
            >
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Gå til dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href={routes.login}
                className={cn(
                  touchTargetLinkClass,
                  'gap-1.5 rounded-full border border-[#00205b]/15 bg-white px-4 text-sm font-semibold text-[#00205b] transition-colors hover:border-[#00205b]/40 hover:bg-[#00205b]/[0.04]',
                )}
              >
                <LogIn className="size-3.5 sm:size-4" />
                Logg inn
              </Link>
              <Link
                href={routes.utforsk}
                className={cn(
                  touchTargetLinkClass,
                  'justify-center rounded-full bg-[#00205b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]',
                )}
              >
                <span className="sm:hidden">Utforsk</span>
                <span className="hidden sm:inline">Utforsk saker</span>
              </Link>
            </>
          )}
        </div>
      </nav>
      <FlagStripe animate={pathname === '/'} />
    </header>
  );
}
