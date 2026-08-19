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
  readOnboardingMetadata,
} from '@/lib/onboarding';

function readLocalTourCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === '1';
}

function writeLocalTourCompleted() {
  window.localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, '1');
}

export function ProductTourHost() {
  const { user, loading } = useAuth();
  const nav = useDashboardNavOptional();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const requested = searchParams.get(PRODUCT_TOUR_QUERY) === '1';

  useEffect(() => {
    if (loading || !user) return;
    if (requested) {
      setOpen(true);
      return;
    }
    const meta = readOnboardingMetadata(user);
    if (meta.tourCompleted || readLocalTourCompleted()) return;
    if (meta.completed || meta.skipped) {
      setOpen(true);
    }
  }, [loading, user, requested]);

  useEffect(() => {
    const onStart = () => setOpen(true);
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

  const finish = useCallback(
    async (persist: boolean) => {
      setOpen(false);
      nav?.setOpen(false);
      writeLocalTourCompleted();
      clearTourQuery();
      if (!persist) return;
      try {
        await fetch('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tour_complete' }),
        });
      } catch {
        // Local completion is enough to avoid repeating the tour.
      }
    },
    [clearTourQuery, nav],
  );

  if (!open) return null;

  return (
    <ProductTour
      onRequestNavOpen={() => nav?.setOpen(true)}
      onRequestNavClose={() => nav?.setOpen(false)}
      onComplete={() => void finish(true)}
      onSkip={() => void finish(true)}
    />
  );
}
