'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BarChart2,
  FileEdit,
  Flame,
  Home,
  MessageSquare,
  Plus,
  Search,
  Users,
  User,
  UserRound,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const MOBILE_SECTION_NAV = [
  { href: routes.forum, label: 'Forum', icon: MessageSquare },
  { href: routes.utforsk, label: 'Saker', icon: Search },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit },
  { href: routes.politikere, label: 'Politikere', icon: Users },
  { href: routes.minSide, label: 'Profil', icon: UserRound },
] as const;

const MOBILE_NAV = [
  { href: routes.forum, label: 'Forumforside', icon: Home, sort: null },
  { href: `${routes.forum}?sort=engasjert`, label: 'Populært', icon: Flame, sort: 'engasjert' },
  { href: `${routes.forum}?sort=nyeste`, label: 'Nyeste', icon: MessageSquare, sort: 'nyeste' },
] as const;

const MOBILE_MORE_NAV = [
  { href: routes.sporsmal, label: 'Spørsmål', icon: MessageSquare },
  { href: routes.innsikt, label: 'Innsikt', icon: BarChart2 },
] as const;

export default function ForumMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'nyeste';
  const sakId = searchParams.get('sak');

  return (
    <div className="xl:hidden mb-4 space-y-3">
      <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Dashboard-navigasjon mobil">
        {MOBILE_SECTION_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border transition-colors',
                active
                  ? 'bg-[#00205b] text-white border-brand'
                  : 'bg-card text-foreground border-border hover:border-border',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        aria-label="Forum-navigasjon mobil"
      >
        {MOBILE_NAV.map(({ href, label, icon: Icon, sort }) => {
          const active =
            pathname === routes.forum &&
            (sort === null ? !searchParams.get('sort') : currentSort === sort);
          const linkHref =
            sakId && href.startsWith(routes.forum)
              ? `${routes.forum}?${new URLSearchParams({ ...(sort ? { sort } : {}), sak: sakId }).toString()}`
              : href;

          return (
            <Link
              key={label}
              href={linkHref}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-border'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
        <Link
          href={routes.forumMineInnlegg}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border transition-colors',
            pathname === routes.forumMineInnlegg
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-foreground border-border hover:border-border',
          )}
        >
          <User className="w-3.5 h-3.5" />
          Mine innlegg
        </Link>
      </nav>
      <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Flere demokrati-lenker mobil">
        {MOBILE_MORE_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold border transition-colors',
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-card text-foreground border-border hover:border-border',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link
        href={routes.forumNew(sakId ?? undefined)}
        className="flex items-center justify-center gap-2 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="w-4 h-4" />
        Del din mening
      </Link>
    </div>
  );
}
