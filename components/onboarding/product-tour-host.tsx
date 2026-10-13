'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProductTour } from '@/components/onboarding/product-tour';
import { useDashboardNavOptional } from '@/components/dashboard/dashboard-nav-context';
import { useAuth } from '@/hooks/use-auth';
import {
  PRODUCT_TOUR_EVENT,
  PRODUCT_TOUR_QUERY,
  PRODUCT_TOUR_STORAGE_KEY,
} from '@/lib/onboarding';
import { isDashboardPath } from '@/lib/routes';

function readLocalTourCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLocalTourCompleted() {
  try {
    window.localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, '1');
  } catch {
    // ignore private mode / quota
  }
}

export function ProductTourHost() {
  const { user, loading } = useAuth();
  const nav = useDashboardNavOptional();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);

  const requested = searchParams.get(PRODUCT_TOUR_QUERY) === '1';
  const onDashboard = isDashboardPath(pathname);
  const open =
    onDashboard && !loading && !!user && !dismissed && (requested || replayNonce > 0);

  useEffect(() => {
    const onStart = () => {
      try {
        window.localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
      } catch {
        // ignore
      }
      setDismissed(false);
      setReplayNonce((value) => value + 1);
    };
    window.addEventListener(PRODUCT_TOUR_EVENT, onStart);
    return () => window.removeEventListener(PRODUCT_TOUR_EVENT, onStart);
  }, []);

  const clearTourQuery = useCallback(() => {
    if (!requested) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete(PRODUCT_TOUR_QUERY);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, requested, router, searchParams]);

  const finish = useCallback(async () => {
    setDismissed(true);
    nav?.setOpen(false);
    writeLocalTourCompleted();
    clearTourQuery();
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tour_complete' }),
      });
    } catch {
      // Local completion is enough to avoid repeating the tour.
    }
  }, [clearTourQuery, nav]);

  if (!open) return null;

  return (
    <ProductTour
      onRequestNavOpen={() => nav?.setOpen(true)}
      onRequestNavClose={() => nav?.setOpen(false)}
      onComplete={() => void finish()}
      onSkip={() => void finish()}
    />
  );
}
