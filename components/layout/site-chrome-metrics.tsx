'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { applyMeasuredSiteHeaderHeight } from '@/lib/layout/site-chrome-css';

const SITE_CHROME_SELECTOR = '[data-site-chrome]';

export function SiteChromeMetrics() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(SITE_CHROME_SELECTOR);
    if (!header) {
      root.removeAttribute('data-site-chrome-variant');
      applyMeasuredSiteHeaderHeight(root, null);
      return undefined;
    }

    const variant = header.dataset.siteChromeVariant ?? 'app';
    root.setAttribute('data-site-chrome-variant', variant);

    const update = () => {
      applyMeasuredSiteHeaderHeight(root, header.getBoundingClientRect().height);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);

    return () => {
      ro.disconnect();
      root.removeAttribute('data-site-chrome-variant');
      applyMeasuredSiteHeaderHeight(root, null);
    };
  }, [pathname]);

  return null;
}
