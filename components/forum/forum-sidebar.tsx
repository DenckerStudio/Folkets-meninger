'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Flame, Home, MessageSquare, Plus, Search, FileEdit, User } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const NAV = [
  { href: routes.forum, label: 'Hjem', icon: Home, sort: null },
  { href: `${routes.forum}?sort=engasjert`, label: 'Populært', icon: Flame, sort: 'engasjert' },
  { href: `${routes.forum}?sort=nyeste`, label: 'Nyeste', icon: MessageSquare, sort: 'nyeste' },
  { href: routes.utforsk, label: 'Utforsk saker', icon: Search, sort: null },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit, sort: null },
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
    <nav className="space-y-1" aria-label="Forum-navigasjon">
      {NAV.map(({ href, label, icon: Icon, sort }) => {
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
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        );
      })}

      <div className="pt-4 mt-4 border-t border-gray-200 space-y-1">
        <Link
          href={routes.forumMineInnlegg}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === routes.forumMineInnlegg
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <User className="w-5 h-5 shrink-0" />
          Mine innlegg
        </Link>
        <Link
          href={sakId ? routes.forumNew(sakId) : routes.forumNew()}
          className="flex items-center justify-center gap-2 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Start diskusjon
        </Link>
      </div>
    </nav>
  );
}
