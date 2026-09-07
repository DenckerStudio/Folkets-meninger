'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { routes } from '@/lib/routes';
import { dashboardSidebarNavItems } from '@/lib/site-nav-links';
import { cn } from '@/lib/utils';

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
      {dashboardSidebarNavItems.map((item) => {
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
      <AdminSidebarLink pathname={pathname} variant={variant} onNavigate={onNavigate} />
    </nav>
  );
}

type AdminSidebarLinkProps = {
  pathname: string;
  variant: 'desktop' | 'drawer';
  onNavigate?: () => void;
};

function AdminSidebarLink({ pathname, variant, onNavigate }: AdminSidebarLinkProps) {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();
  const isDrawer = variant === 'drawer';

  if (!user || !isAdminUser) return null;

  const active = pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);

  return (
    <Link
      href={routes.admin}
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
      <Shield className={cn('shrink-0', isDrawer ? 'h-[1.125rem] w-[1.125rem]' : 'h-4 w-4')} />
      Admin
    </Link>
  );
}
