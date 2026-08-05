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
  Vote,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const FORUM_NAV = [
  { href: routes.forum, label: 'Forumforside', icon: Home, sort: null },
  { href: `${routes.forum}?sort=engasjert`, label: 'Populært', icon: Flame, sort: 'engasjert' },
  { href: `${routes.forum}?sort=nyeste`, label: 'Nyeste', icon: MessageSquare, sort: 'nyeste' },
] as const;

const DEMOCRACY_NAV = [
  { href: routes.utforsk, label: 'Saker', icon: Search, active: (pathname: string) => pathname.startsWith(routes.utforsk) || pathname.startsWith('/dashboard/sak/') },
  { href: routes.avstemninger, label: 'Avstemninger', icon: Vote, active: (pathname: string) => pathname.startsWith(routes.avstemninger) || pathname.startsWith(routes.initiativ) },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit, active: (pathname: string) => pathname.startsWith(routes.horinger) },
  { href: routes.politikere, label: 'Politikere', icon: Users, active: (pathname: string) => pathname.startsWith(routes.politikere) || pathname.startsWith(routes.representanter) },
  { href: routes.sporsmal, label: 'Spørsmål', icon: MessageSquare, active: (pathname: string) => pathname.startsWith(routes.sporsmal) },
  { href: routes.innsikt, label: 'Innsikt', icon: BarChart2, active: (pathname: string) => pathname.startsWith(routes.innsikt) },
] as const;

export default function ForumSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'nyeste';
  const sakId = searchParams.get('sak');
  const q = searchParams.get('q');

  const forumHref = (sort: string | null) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (sakId) params.set('sak', sakId);
    if (q && q.trim().length >= 2) params.set('q', q.trim());
    const qs = params.toString();
    return qs ? `${routes.forum}?${qs}` : routes.forum;
  };

  return (
    <nav className="space-y-5" aria-label="Forum-navigasjon">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Forum
        </p>
      {FORUM_NAV.map(({ href, label, icon: Icon, sort }) => {
        const isForumHome = href.startsWith(routes.forum);
        const active =
          isForumHome &&
          pathname === routes.forum &&
          (sort === null
            ? !searchParams.get('sort')
            : currentSort === sort);

        const linkHref = isForumHome ? forumHref(sort) : href;

        return (
          <Link
            key={label}
            href={linkHref}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        );
      })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Demokrati
        </p>
        {DEMOCRACY_NAV.map(({ href, label, icon: Icon, active }) => {
          const isActive = active(pathname);
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm space-y-1">
        <Link
          href={routes.forumMineInnlegg}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === routes.forumMineInnlegg
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <User className="w-5 h-5 shrink-0" />
          Mine innlegg
        </Link>
        <Link
          href={routes.forumNew(sakId ?? undefined)}
          className="flex items-center justify-center gap-2 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Del din mening
        </Link>
      </div>
    </nav>
  );
}
