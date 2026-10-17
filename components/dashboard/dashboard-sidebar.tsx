'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { dashboardSidebarNavItemsForAdmin } from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type DashboardSidebarProps = {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
};

export default function DashboardSidebar({ variant = 'desktop', onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();
  const isDrawer = variant === 'drawer';
  const navItems = useMemo(
    () => dashboardSidebarNavItemsForAdmin(isAdminUser),
    [isAdminUser],
  );

  if (isDrawer) {
    return (
      <nav className="space-y-0.5" aria-label="Dashbordmeny">
        {navItems.map((item) => {
          const active = item.isActive?.(pathname) ?? false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              data-tour={item.href === routes.utforsk ? 'utforsk' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 font-medium transition-colors rounded-lg border-l-[3px] px-3 py-2.5 text-[0.9375rem]',
                active
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-transparent text-foreground/85 hover:bg-muted/70 hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
              <span className="flex-1">{item.title}</span>
              {!user && item.loginRequired ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-2.5">
      <nav className="space-y-1" aria-label="Dashbordmeny">
      {navItems.map((item) => {
        const active = item.isActive?.(pathname) ?? false;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-tour={item.href === routes.utforsk ? 'utforsk' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand/10 text-brand'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.title}</span>
            {!user && item.loginRequired ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
          </Link>
        );
      })}
      </nav>
    </div>
  );
}
