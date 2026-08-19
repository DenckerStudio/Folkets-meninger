'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  FileEdit,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const NAV = [
  { href: routes.utforsk, label: 'Utforsk', icon: Search, match: (p: string) => p.startsWith(routes.utforsk) || p.startsWith(`${routes.dashboard}/sak/`) },
  { href: routes.politikere, label: 'Politikere', icon: Users, match: (p: string) => p.startsWith(routes.politikere) },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit, match: (p: string) => p.startsWith(routes.horinger) },
  { href: routes.innsikt, label: 'Innsikt', icon: BarChart2, match: (p: string) => p.startsWith(routes.innsikt) },
  { href: routes.minSide, label: 'Min side', icon: UserRound, match: (p: string) => p.startsWith(routes.minSide) },
] as const;

export default function DashboardSidebar() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="space-y-1 rounded-xl border border-border bg-card p-3" aria-label="Dashbordmeny">
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand/10 text-brand'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
