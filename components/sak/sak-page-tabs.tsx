'use client';

import { useCallback, useEffect, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  SAK_PAGE_TAB_IDS,
  SAK_PAGE_TAB_LABELS,
  sakPageTabFromLocationHash,
  type SakPageTabId,
} from '@/lib/sak/sak-page-tabs';

function isSakPageTabId(value: string): value is SakPageTabId {
  return (SAK_PAGE_TAB_IDS as readonly string[]).includes(value);
}

function readTabFromQuery(searchParams: URLSearchParams): SakPageTabId | null {
  const raw = searchParams.get('fane')?.trim().toLowerCase();
  if (raw && isSakPageTabId(raw)) return raw;
  return null;
}

function replaceTabInUrl(pathname: string, searchParams: URLSearchParams, tabId: SakPageTabId): string {
  const params = new URLSearchParams(searchParams.toString());
  if (tabId === 'oversikt') {
    params.delete('fane');
  } else {
    params.set('fane', tabId);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function navigateToSakTab(tabId: SakPageTabId) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (tabId === 'oversikt') url.searchParams.delete('fane');
  else url.searchParams.set('fane', tabId);
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new Event('sak-tab-change'));
}

export function SakPageTabs({
  initialTab,
  documentCount,
  oversikt,
  argumenter,
  dokumenter,
  stortinget,
  diskusjon,
  konsekvens,
}: {
  initialTab: SakPageTabId;
  documentCount?: number;
  oversikt: ReactNode;
  argumenter: ReactNode;
  dokumenter: ReactNode;
  stortinget: ReactNode;
  diskusjon: ReactNode;
  konsekvens: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const active = readTabFromQuery(searchParams) ?? initialTab;

  useEffect(() => {
    if (readTabFromQuery(searchParams)) return;
    const legacy = sakPageTabFromLocationHash(window.location.hash);
    if (legacy) {
      router.replace(replaceTabInUrl(pathname, searchParams, legacy), { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const onHashChange = () => {
      if (readTabFromQuery(searchParams)) return;
      const legacy = sakPageTabFromLocationHash(window.location.hash);
      if (legacy) {
        router.replace(replaceTabInUrl(pathname, searchParams, legacy), { scroll: false });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [pathname, router, searchParams]);

  const tabs = useMemo(
    () =>
      SAK_PAGE_TAB_IDS.map((id) => ({
        id,
        label:
          id === 'dokumenter' && documentCount != null && documentCount > 0
            ? `${SAK_PAGE_TAB_LABELS[id]} (${documentCount})`
            : SAK_PAGE_TAB_LABELS[id],
      })),
    [documentCount],
  );

  const selectTab = useCallback(
    (id: string) => {
      if (!isSakPageTabId(id)) return;
      const href = replaceTabInUrl(pathname, searchParams, id);
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
        return;
      }
      event.preventDefault();
      const index = SAK_PAGE_TAB_IDS.indexOf(active);
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % SAK_PAGE_TAB_IDS.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + SAK_PAGE_TAB_IDS.length) % SAK_PAGE_TAB_IDS.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = SAK_PAGE_TAB_IDS.length - 1;
      selectTab(SAK_PAGE_TAB_IDS[next]);
      const button = document.getElementById(`sak-tab-${SAK_PAGE_TAB_IDS[next]}`);
      button?.focus();
    },
    [active, selectTab],
  );

  const panels: Record<SakPageTabId, ReactNode> = {
    oversikt,
    argumenter,
    dokumenter,
    stortinget,
    diskusjon,
    konsekvens,
  };

  return (
    <div className="space-y-6">
      <nav
        className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:px-0"
        aria-label="Saksseksjoner"
        onKeyDown={onTabKeyDown}
      >
        <AnimatedTabs
          tabs={tabs}
          activeId={active}
          onSelect={selectTab}
          layoutId="sak-page-tabs"
          idPrefix="sak-tab"
          ariaLabel="Sakfaner"
          className="w-max min-w-full sm:w-auto sm:min-w-0"
          tabClassName="shrink-0 text-xs sm:text-sm"
        />
      </nav>

      <AnimatePresence mode="wait">
        {SAK_PAGE_TAB_IDS.map((id) =>
          active === id ? (
            <motion.section
              key={id}
              id={`sak-fane-${id}`}
              role="tabpanel"
              aria-labelledby={`sak-tab-${id}`}
              tabIndex={0}
              className="space-y-6 focus:outline-none"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {panels[id]}
            </motion.section>
          ) : null,
        )}
      </AnimatePresence>
    </div>
  );
}