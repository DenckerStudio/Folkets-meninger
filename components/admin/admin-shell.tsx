'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import {
  adminHubNavItem,
  adminNavIsActive,
  adminNavItems,
  type AdminNavItem,
} from '@/lib/admin/nav';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const adminSectionNav = [adminHubNavItem, ...adminNavItems.filter((item) => item.status === 'active')];

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname() ?? '';

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-brand" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Verktøy for drift, innhold og statistikk i Folkets Stemme.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-2 border-b border-border pb-4"
        aria-label="Admin-navigasjon"
      >
        {adminSectionNav.map((item) => {
          if (!item.href) return null;
          const active = adminNavIsActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}

type AdminHubCardProps = {
  item: AdminNavItem;
};

export function AdminHubCard({ item }: AdminHubCardProps) {
  const Icon = item.icon;
  const isComing = item.status === 'coming';

  const cardClassName = cn(
    'flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors',
    !isComing && item.href && 'hover:border-brand/40 hover:bg-muted/30',
    isComing && 'opacity-80',
  );

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">{item.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
          </div>
        </div>
        {isComing ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Kommer
          </span>
        ) : null}
      </div>
      {!isComing && item.href ? (
        <span className="mt-4 text-sm font-medium text-brand">Åpne →</span>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {item.id === 'brukere'
            ? 'Rolle-API finnes — dedikert brukergrensesnitt kommer.'
            : 'Planlagt admin-verktøy.'}
        </p>
      )}
    </>
  );

  if (!isComing && item.href) {
    return (
      <Link href={item.href} className={cardClassName}>
        {inner}
      </Link>
    );
  }

  return <article className={cardClassName}>{inner}</article>;
}

export function AdminHubGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {adminNavItems.map((item) => (
        <AdminHubCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function AdminBackLink() {
  return (
    <Link href={routes.admin} className="text-sm font-medium text-brand hover:underline">
      ← Tilbake til admin
    </Link>
  );
}
