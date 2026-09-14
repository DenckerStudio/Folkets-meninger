'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { dashboardSidebarNavItemsForAdmin } from '@/lib/site-nav-links';
import { cn } from '@/lib/utils';

type DashboardSidebarProps = {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
};

export default function DashboardSidebar({ variant = 'desktop', onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname() ?? '';
  const isAdminUser = useIsAdmin();
  const isDrawer = variant === 'drawer';
  const navItems = useMemo(
    () => dashboardSidebarNavItemsForAdmin(isAdminUser),
    [isAdminUser],
  );

  return (
    <nav
      className={cn(
        isDrawer ? 'space-y-0.5' : 'space-y-1 rounded-xl border border-border bg-card p-2.5',
      )}
      aria-label="Dashbordmeny"
    >
      {navItems.map((item) => {
        const active = item.isActive?.(pathname) ?? false;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
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
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
