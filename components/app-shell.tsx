'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { isEmbedPath, isMarketingPath } from '@/lib/routes';

/**
 * App chrome wrapper. Embed routes (`/embed/*`) render bare — no navigation,
 * skip-link or outer padding — so the iframe fills the host's container exactly.
 * Marketing routes (`/`, `/innspill`) render full width; its sections manage their own containers.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isEmbedPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-background focus:text-brand focus:rounded-lg focus:shadow"
      >
        Hopp til hovedinnhold
      </a>
      <Navigation>
        <main
          id="main-content"
          className={
            isMarketingPath(pathname)
              ? 'w-full max-w-none px-0 py-0'
              : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8'
          }
        >
          {children}
        </main>
      </Navigation>
    </>
  );
}
