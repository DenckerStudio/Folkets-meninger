'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Calendar,
  FileEdit,
  Search,
  UserRound,
  Users,
  Vote,
} from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const NAV = [
  { href: routes.utforsk, label: 'Utforsk', icon: Search, match: (p: string) => p.startsWith(routes.utforsk) || p.startsWith(`${routes.dashboard}/sak/`) },
  { href: routes.avstemninger, label: 'Avstemninger', icon: Vote, match: (p: string) => p.startsWith(routes.avstemninger) },
  { href: routes.politikere, label: 'Politikere', icon: Users, match: (p: string) => p.startsWith(routes.politikere) },
  { href: routes.horinger, label: 'Høringer', icon: FileEdit, match: (p: string) => p.startsWith(routes.horinger) },
  { href: routes.kalender, label: 'Kalender', icon: Calendar, match: (p: string) => p.startsWith(routes.kalender) },
  { href: routes.innsikt, label: 'Innsikt', icon: BarChart2, match: (p: string) => p.startsWith(routes.innsikt) },
  { href: routes.minSide, label: 'Min side', icon: UserRound, match: (p: string) => p.startsWith(routes.minSide) },
] as const;

type DashboardSidebarProps = {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
};

export default function DashboardSidebar({ variant = 'desktop', onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname() ?? '';
  const isDrawer = variant === 'drawer';

  return (
    <nav
      className={cn(
        isDrawer ? 'space-y-0.5' : 'space-y-1 rounded-xl border border-border bg-card p-2.5',
      )}
      aria-label="Dashbordmeny"
    >
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 font-medium transition-colors',
              isDrawer
                ? cn(
                    'rounded-lg border-l-[3px] px-3 py-2.5 text-[0.9375rem]',
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-transparent text-foreground/85 hover:bg-muted/70 hover:text-foreground',
                  )
                : cn(
                    'rounded-lg px-3 py-2 text-sm',
                    active
                      ? 'bg-brand/10 text-brand'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ),
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className={cn('shrink-0', isDrawer ? 'h-[1.125rem] w-[1.125rem]' : 'h-4 w-4')} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
