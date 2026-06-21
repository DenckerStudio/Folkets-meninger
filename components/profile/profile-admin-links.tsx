'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, Flag, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { ProfileCard } from '@/components/profile/profile-card';

/** Admin shortcuts for mobile (desktop uses Mer dropdown). */
export function ProfileAdminLinks() {
  const { user } = useAuth();
  const [isForumAdmin, setIsForumAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((json) => setIsForumAdmin(!!json.admin))
      .catch(() => setIsForumAdmin(false));
  }, [user]);

  if (!user || !isForumAdmin) return null;

  return (
    <ProfileCard title="Admin" description="Verktøy for forum-moderering og statistikk." className="md:hidden">
      <ul className="space-y-1">
        <li>
          <Link
            href={routes.adminForumReports}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Flag className="w-4 h-4 text-gray-500" />
            Rapporter
          </Link>
        </li>
        <li>
          <Link
            href={routes.adminStats}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <BarChart2 className="w-4 h-4 text-gray-500" />
            Statistikk
          </Link>
        </li>
        <li>
          <Link
            href={`${routes.adminForumPrompts}?tab=pipeline`}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Sparkles className="w-4 h-4 text-gray-500" />
            Forum Reels
          </Link>
        </li>
      </ul>
    </ProfileCard>
  );
}
