'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { routes } from '@/lib/routes';
import { isAdminActive } from '@/lib/site-nav-links';
import { cn } from '@/lib/utils';

type AdminMoreNavLinkProps = {
  pathname: string;
};

/** Admin hub link shown in the desktop «Mer» dropdown for admins only. */
export function AdminMoreNavLink({ pathname }: AdminMoreNavLinkProps) {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();

  if (!user || !isAdminUser) return null;

  const active = isAdminActive(pathname);

  return (
    <Link
      href={routes.admin}
      className={cn(
        'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50',
        active && 'bg-brand/10',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="block text-sm font-medium text-foreground">Admin</span>
        <span className="block text-xs text-muted-foreground">Drift, Reels og statistikk</span>
      </span>
    </Link>
  );
}
