'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { legacyTabRedirectPath } from '@/lib/min-side/sections';
import { routes } from '@/lib/routes';

/** Redirects legacy `/dashboard/min-side?tab=…` bookmarks to nested routes. */
export function MinSideLegacyTabRedirect() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== routes.minSide) return;
    const tab = searchParams.get('tab');
    const tour = searchParams.get('tour');
    const target = legacyTabRedirectPath(tab);
    if (!target) return;
    const url = new URL(target, 'https://local.invalid');
    if (tour) url.searchParams.set('tour', tour);
    const checkout = searchParams.get('checkout');
    if (checkout) url.searchParams.set('checkout', checkout);
    router.replace(`${url.pathname}${url.search}`);
  }, [pathname, router, searchParams]);

  return null;
}