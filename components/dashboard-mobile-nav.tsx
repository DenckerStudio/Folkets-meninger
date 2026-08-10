'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileEdit, Search, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';

const DASHBOARD_MOBILE_ITEMS = [
  { href: routes.utforsk, label: 'Utforsk', icon: Search },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit },
  { href: routes.politikere, label: 'Politikere', icon: Users },
  { href: routes.minSide, label: 'Profil', icon: UserRound },
] as const;

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card/95 px-4 py-2 backdrop-blur md:hidden">
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Dashboard-navigasjon mobil">
        {DASHBOARD_MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-card text-foreground hover:border-border',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
