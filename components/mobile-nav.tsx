'use client';

import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/interactive-menu';
import { useAuth } from '@/hooks/use-auth';
import { mobileNavItems } from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';

export function MobileNav() {
  const { user } = useAuth();

  const items: InteractiveMenuItem[] = mobileNavItems.map((item) =>
    item.href === routes.minSide && !user
      ? { ...item, href: routes.login, label: 'Logg inn' }
      : { ...item },
  );

  return (
    <div className="md:hidden">
      <InteractiveMenu items={items} accentColor="#00205b" />
    </div>
  );
}
