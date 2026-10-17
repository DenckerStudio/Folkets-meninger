'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MessageSquarePlus } from 'lucide-react';
import { LandingLogo } from '@/components/landing-logo';
import { FlagStripe } from '@/components/motion/flag-stripe';
import { routes } from '@/lib/routes';
import { touchTargetLinkClass } from '@/lib/touch-target';
import { useAuth } from '@/hooks/use-auth';

const platformLinks = [
  { href: routes.utforsk, label: 'Utforsk saker' },
  { href: routes.horinger, label: 'Høringer' },
  { href: routes.politikere, label: 'Politikere' },
  { href: routes.folketsMeninger, label: 'Folkets meninger' },
] as const;

const trustLinks = [
  { href: routes.personvern, label: 'Personvern' },
  { href: routes.vilkar, label: 'Brukervilkår' },
  { href: routes.omAi, label: 'AI og modeller' },
] as const;

const signedOutAboutLinks = [
  { href: routes.omOss, label: 'Om oss' },
  { href: routes.login, label: 'Logg inn' },
] as const;

const signedInAboutLinks = [
  { href: routes.omOss, label: 'Om oss' },
  { href: routes.dashboard, label: 'Dashboard' },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const aboutLinks = user ? signedInAboutLinks : signedOutAboutLinks;

  return (
    <footer className="mt-8 border-t border-[#00205b]/10 bg-[#f7f8fb] text-[#001433]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <div className="lg:col-span-2">
            <Link
              href={routes.home}
              aria-label="Folkets Meninger – til forsiden"
              className="inline-flex rounded-md transition-opacity hover:opacity-90"
            >
              <LandingLogo clipId="fs-footer-bubble" />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#001433]/65">
              Uavhengig plattform for stemmegivning og høringer.
            </p>
            <Link
              href={routes.innspill}
              className={cn(
                touchTargetLinkClass,
                'mt-5 gap-2 text-sm font-medium text-[#00205b] transition-colors hover:text-[#ba0c2f]',
              )}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              Kontakt oss / gi innspill
            </Link>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ba0c2f]">Plattform</h2>
            <ul className="mt-4 space-y-3">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      touchTargetLinkClass,
                      'text-sm text-[#001433]/70 transition-colors hover:text-[#ba0c2f]',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ba0c2f]">Tillit</h2>
            <ul className="mt-4 space-y-3">
              {trustLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      touchTargetLinkClass,
                      'text-sm text-[#001433]/70 transition-colors hover:text-[#ba0c2f]',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ba0c2f]">Om</h2>
            <ul className="mt-4 space-y-3">
              {aboutLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      touchTargetLinkClass,
                      'text-sm text-[#001433]/70 transition-colors hover:text-[#ba0c2f]',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[#00205b]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#001433]/70">© {year} Folkets Meninger. Alle rettigheter forbeholdt.</p>
          <p className="text-xs text-[#001433]/70">
            Uavhengig initiativ — vi samarbeider ikke med Regjeringen eller Stortinget.
          </p>
        </div>
      </div>
      <FlagStripe animate />
    </footer>
  );
}
