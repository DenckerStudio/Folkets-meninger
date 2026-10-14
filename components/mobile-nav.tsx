'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/interactive-menu';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { adminAccountNavItem, mobileNavItems, isMinSideActive } from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';
import { loginWithNext } from '@/lib/safe-redirect';
import { UserRound } from 'lucide-react';

export function MobileNav() {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();
  const pathname = usePathname();
  const loginHref = loginWithNext(pathname);

  const items: InteractiveMenuItem[] = useMemo(() => {
    // Use first 4 mobileNavItems (Meninger, Utforsk, Avstemninger, Høringer) + Profil/Logg inn
    const baseItems = mobileNavItems.slice(0, 4);
    const base = baseItems.map((item) => ({ ...item }));

    // Add Profil/Logg inn as the 5th item
    const profileItem: InteractiveMenuItem = user
      ? { label: 'Profil', href: routes.minSide, icon: UserRound, isActive: isMinSideActive }
      : { label: 'Logg inn', href: loginHref, icon: UserRound, isActive: isMinSideActive };

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