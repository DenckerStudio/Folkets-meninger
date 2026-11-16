'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MIN_SIDE_NAV_ITEMS, resolveMinSideSectionId } from '@/lib/min-side/sections';
import { cn } from '@/lib/utils';

type MinSideLayoutProps = {
  children: React.ReactNode;
};

export function MinSideLayout({ children }: MinSideLayoutProps) {
  const pathname = usePathname() ?? '';
  const activeId = resolveMinSideSectionId(pathname);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Min side</h1>
        <p className="text-sm text-muted-foreground">
          Innstillinger, stemmer og konto på ett sted.
        </p>
      </div>

      <div className="min-w-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <MinSideSideNav activeId={activeId} className="hidden lg:block" />
        <MinSideMobileNav activeId={activeId} className="lg:hidden" />

        <div className="min-w-0 pt-4 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}

function MinSideSideNav({
  activeId,
  className,
}: {
  activeId: string;
  className?: string;
}) {
  return (
    <nav className={cn('space-y-1', className)} aria-label="Min side">
      <ul className="space-y-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
        {MIN_SIDE_NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  active
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MinSideMobileNav({
  activeId,
  className,
}: {
  activeId: string;
  className?: string;
}) {
  return (
    <div className={cn('-mx-1', className)}>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Min side"
      >
        {MIN_SIDE_NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                active
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}