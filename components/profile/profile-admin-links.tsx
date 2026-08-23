'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { ProfileCard } from '@/components/profile/profile-card';

/** Admin shortcuts for mobile (desktop uses Mer dropdown). */
export function ProfileAdminLinks() {
  const { user } = useAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((json) => setIsAdminUser(!!json.admin))
      .catch(() => setIsAdminUser(false));
  }, [user]);

  if (!user || !isAdminUser) return null;

  return (
    <ProfileCard title="Admin" description="Verktøy for statistikk og drift." className="md:hidden">
      <ul className="space-y-1">
        <li>
          <Link
            href={routes.adminStats}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            Statistikk
          </Link>
        </li>
        <li>
          <Link
            href={routes.adminReels}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            Reels
          </Link>
        </li>
      </ul>
    </ProfileCard>
  );
}
