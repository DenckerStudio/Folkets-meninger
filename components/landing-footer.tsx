import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import { LandingLogo } from '@/components/landing-logo';
import { routes } from '@/lib/routes';

const platformLinks = [
  { href: routes.utforsk, label: 'Utforsk saker' },
  { href: routes.forum, label: 'Forum' },
  { href: routes.horinger, label: 'Høringer' },
  { href: routes.politikere, label: 'Politikere' },
] as const;

const aboutLinks = [
  { href: routes.omOss, label: 'Om oss' },
  { href: routes.innspill, label: 'Gi innspill' },
  { href: routes.login, label: 'Logg inn' },
  { href: routes.dashboard, label: 'Dashboard' },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-[#00205b]/10 bg-[#f7f8fb] text-[#001433]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:col-span-2">
            <Link href={routes.home} className="inline-flex rounded-md transition-opacity hover:opacity-90">
              <LandingLogo clipId="fs-footer-bubble" />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#001433]/65">
              Uavhengig plattform for stemmegivning, forum og høringer — demokratiet fortsetter mellom valgene.
            </p>
            <Link
              href={routes.innspill}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#00205b] transition-colors hover:text-[#ba0c2f]"
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
                    className="text-sm text-[#001433]/70 transition-colors hover:text-[#ba0c2f]"
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
                    className="text-sm text-[#001433]/70 transition-colors hover:text-[#ba0c2f]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[#00205b]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#001433]/50">© {year} Folkets Stemme. Alle rettigheter forbeholdt.</p>
          <p className="text-xs text-[#001433]/50">
            Uavhengig initiativ — vi samarbeider ikke med Regjeringen eller Stortinget.
          </p>
        </div>
      </div>
      <div className="flex h-1.5 w-full" aria-hidden>
        <span className="flex-1 bg-[#ba0c2f]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#00205b]" />
      </div>
    </footer>
  );
}
