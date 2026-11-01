'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';
import { buildPageViewBody, shouldTrackPath } from '@/lib/analytics/page-view';

function AnalyticsPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!isAnalyticsEnabled()) {
      return;
    }
    if (!shouldTrackPath(pathname)) {
      return;
    }

    const body = buildPageViewBody({
      pathname,
      search,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });

    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  }, [pathname, search]);

  return null;
}

export function AnalyticsPageView() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageViewTracker />
    </Suspense>
  );
}
