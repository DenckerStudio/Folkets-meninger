'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';

export function MobileTopBar() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      fetch('/api/notifications/unread-count', { cache: 'no-store' })
        .then((res) => res.json())
        .then((json) => setUnread(Number(json.count || 0)))
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  if (!user) return null;

  return (
    <div className="md:hidden fixed top-0 right-0 z-40 p-3 safe-area-inset-top">
      <Link
        href={routes.varsler}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
        aria-label="Varsler"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
