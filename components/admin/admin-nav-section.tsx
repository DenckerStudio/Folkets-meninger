'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { adminNavLinks } from '@/lib/admin-nav-links';
import { useForumAdmin } from '@/hooks/use-forum-admin';
import { cn } from '@/lib/utils';

type AdminNavSectionProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AdminNavSection({ className, onNavigate }: AdminNavSectionProps) {
  const pathname = usePathname();
  const { isAdmin, loading } = useForumAdmin();

  if (loading || !isAdmin) return null;

  return (
    <div className={cn('rounded-2xl border border-amber-200 bg-amber-50/60 p-3 shadow-sm', className)}>
      <p className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
        <Shield className="h-3.5 w-3.5" aria-hidden />
        Admin
      </p>
      {adminNavLinks.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-amber-100 text-amber-950'
                : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
