'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mobileNavItems, mobileMoreNavItems } from '@/lib/site-nav-links';
import { useDashboardNavOptional } from '@/components/dashboard/dashboard-nav-context';
import { routes } from '@/lib/routes';

export function DashboardMobileNav() {
  const pathname = usePathname();
  const nav = useDashboardNavOptional();

  const isMoreActive = mobileMoreNavItems.some((item) => item.isActive?.(pathname));

  return (
    <div className="border-b border-border bg-card/95 px-4 py-2 backdrop-blur md:hidden">
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Dashboard-navigasjon mobil">
        {mobileNavItems.map((item) => {
          const active = item.action === 'more' ? isMoreActive : item.isActive?.(pathname) ?? false;

          if (item.action === 'more') {
            if (!nav) {
              return (
                <Link
                  key={item.href}
                  href={routes.minSide}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-border bg-card text-foreground hover:border-border',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => nav?.setOpen(true)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-border bg-card text-foreground hover:border-border',
                )}
                aria-haspopup="dialog"
                aria-expanded={nav.open ?? false}
                aria-label="Mer"
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-card text-foreground hover:border-border',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}