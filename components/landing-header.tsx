'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        'sticky top-0 z-50 w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/80',
        scrolled ? 'border-border shadow-sm backdrop-blur-lg' : 'border-border/60',
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={routes.home} className="hover:opacity-90 rounded-md p-1 transition-opacity">
          <FolketsStemmeLogo />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={routes.omOss}
            className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2"
          >
            Om oss
          </Link>
          {user ? (
            <Button render={<Link href={routes.dashboard} />}>Gå til dashboard</Button>
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

function FolketsStemmeLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 200 250" className="h-10 w-8 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <clipPath id="fs-landing-bubble">
          <path d="M 40 0 H 160 A 40 40 0 0 1 200 40 V 160 A 40 40 0 0 1 160 200 H 140 L 145 240 L 100 200 H 40 A 40 40 0 0 1 0 160 V 40 A 40 40 0 0 1 40 0 Z" />
        </clipPath>
        <g clipPath="url(#fs-landing-bubble)">
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
