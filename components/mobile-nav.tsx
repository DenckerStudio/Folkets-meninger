'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/interactive-menu';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { adminAccountNavItem, mobileNavItems } from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';
import { loginWithNext } from '@/lib/safe-redirect';

export function MobileNav() {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();
  const pathname = usePathname();
  const loginHref = loginWithNext(pathname);

  const items: InteractiveMenuItem[] = useMemo(() => {
    // Use first 4 mobileNavItems (Meninger, Utforsk, Avstemninger, Høringer) + Profil/Logg inn
    const baseItems = mobileNavItems.slice(0, 4);
    const base = baseItems.map((item) =>
      item.href === routes.minSide && !user
        ? { ...item, href: loginHref, label: 'Logg inn' }
        : { ...item },
    );

    // Add Profil/Logg inn as the 5th item
    const profileItem: InteractiveMenuItem = user
      ? { label: 'Profil', href: routes.minSide, icon: mobileNavItems[4].icon, isActive: mobileNavItems[4].isActive }
      : { label: 'Logg inn', href: loginHref, icon: mobileNavItems[4].icon, isActive: mobileNavItems[4].isActive };

    const withProfile = [...base, profileItem];

    if (!isAdminUser) return withProfile;

    const profile = withProfile[withProfile.length - 1];
    const withoutProfile = withProfile.slice(0, -1);
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
  }, [isAdminUser, loginHref, user]);

  return (
    <div className="xl:hidden">
      <InteractiveMenu items={items} accentColor="#00205b" />
    </div>
  );
}