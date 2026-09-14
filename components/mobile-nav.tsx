'use client';

import { useMemo } from 'react';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/interactive-menu';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { adminAccountNavItem, mobileNavItems } from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';

export function MobileNav() {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();

  const items: InteractiveMenuItem[] = useMemo(() => {
    const base = mobileNavItems.map((item) =>
      item.href === routes.minSide && !user
        ? { ...item, href: routes.login, label: 'Logg inn' }
        : { ...item },
    );

    if (!isAdminUser) return base;

    const profile = base[base.length - 1];
    const withoutProfile = base.slice(0, -1);
    return [
      ...withoutProfile,
      {
        label: adminAccountNavItem.title,
        href: adminAccountNavItem.href,
        icon: adminAccountNavItem.icon,
        isActive: adminAccountNavItem.isActive ?? (() => false),
      },
      profile,
    ];
  }, [isAdminUser, user]);

  return (
    <div className="xl:hidden">
      <InteractiveMenu items={items} accentColor="#00205b" />
    </div>
  );
}
