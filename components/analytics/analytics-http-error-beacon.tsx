'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';

type AnalyticsHttpErrorBeaconProps = {
  status: number;
};

/** Client beacon for soft 404 / error pages (anonymous). */
export function AnalyticsHttpErrorBeacon({ status }: AnalyticsHttpErrorBeaconProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAnalyticsEnabled()) {
      return;
    }
    if (!Number.isInteger(status) || status < 400) {
      return;
    }

    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'http_error',
        path: pathname || '/',
        status,
        method: 'GET',
      }),
      keepalive: true,
    });
  }, [pathname, status]);

  return null;
}
