'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { LandingLogo } from '@/components/landing-logo';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
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

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full bg-white/95 pt-[env(safe-area-inset-top,0px)] supports-[backdrop-filter]:bg-white/85',
        scrolled ? 'shadow-sm backdrop-blur-lg' : '',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={routes.home} className="rounded-md p-1 transition-opacity hover:opacity-90">
          <LandingLogo clipId="fs-header-bubble" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={routes.omOss}
            className="hidden sm:inline-flex text-sm font-medium text-[#001433]/65 hover:text-[#ba0c2f] px-3 py-2 transition-colors"
          >
            Om oss
          </Link>
          {user ? (
            <Link
              href={routes.dashboard}
              className="inline-flex items-center rounded-full bg-[#00205b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba0c2f] transition-colors"
            >
              Gå til dashboard
            </Link>
          ) : (
            <>
              <Link
                href={routes.login}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#00205b]/15 bg-white px-4 py-2 text-sm font-semibold text-[#00205b] hover:border-[#00205b]/40 hover:bg-[#00205b]/[0.04] transition-colors"
              >
                <LogIn className="size-4" />
                Logg inn
              </Link>
              <Link
                href={routes.login}
                className="inline-flex items-center rounded-full bg-[#00205b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba0c2f] transition-colors"
              >
                Kom i gang
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="flex h-1.5 w-full" aria-hidden>
        <span className="flex-1 bg-[#ba0c2f]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#00205b]" />
      </div>
    </header>
  );
}
