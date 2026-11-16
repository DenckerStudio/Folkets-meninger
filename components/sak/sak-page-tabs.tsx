'use client';

import { useCallback, useEffect, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  SAK_PAGE_TAB_IDS,
  SAK_PAGE_TAB_LABELS,
  SAK_PAGE_TABS_HIDDEN_UNTIL_CONTENT,
  sakPageTabFromLocationHash,
  visibleSakPageTabIds,
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

const DEFAULT_HIDDEN = new Set<SakPageTabId>(SAK_PAGE_TABS_HIDDEN_UNTIL_CONTENT);

export function SakPageTabs({
  initialTab,
  documentCount,
  hiddenTabIds = DEFAULT_HIDDEN,
  oversikt,
  argumenter = null,
  dokumenter,
  stortinget,
  diskusjon,
  konsekvens,
}: {
  initialTab: SakPageTabId;
  documentCount?: number;
  hiddenTabIds?: ReadonlySet<SakPageTabId>;
  oversikt: ReactNode;
  argumenter?: ReactNode;
  dokumenter: ReactNode;
  stortinget: ReactNode;
  diskusjon: ReactNode;
  konsekvens: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const tabOrder = useMemo(() => visibleSakPageTabIds(hiddenTabIds), [hiddenTabIds]);

  const rawActive = readTabFromQuery(searchParams) ?? initialTab;
  const active = hiddenTabIds.has(rawActive) ? 'oversikt' : rawActive;

  useEffect(() => {
    if (hiddenTabIds.has(rawActive)) {
      router.replace(replaceTabInUrl(pathname, searchParams, 'oversikt'), { scroll: false });
    }
  }, [rawActive, hiddenTabIds, pathname, router, searchParams]);

  useEffect(() => {
    if (readTabFromQuery(searchParams)) return;
    const legacy = sakPageTabFromLocationHash(window.location.hash);
    if (legacy && !hiddenTabIds.has(legacy)) {
      router.replace(replaceTabInUrl(pathname, searchParams, legacy), { scroll: false });
    }
  }, [searchParams, pathname, router, hiddenTabIds]);

  useEffect(() => {
    const onHashChange = () => {
      if (readTabFromQuery(searchParams)) return;
      const legacy = sakPageTabFromLocationHash(window.location.hash);
      if (legacy && !hiddenTabIds.has(legacy)) {
        router.replace(replaceTabInUrl(pathname, searchParams, legacy), { scroll: false });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [pathname, router, searchParams, hiddenTabIds]);

  const tabs = useMemo(
    () =>
      tabOrder.map((id) => ({
        id,
        label:
          id === 'dokumenter' && documentCount != null && documentCount > 0
            ? `${SAK_PAGE_TAB_LABELS[id]} (${documentCount})`
            : SAK_PAGE_TAB_LABELS[id],
      })),
    [documentCount, tabOrder],
  );

  const selectTab = useCallback(
    (id: string) => {
      if (!isSakPageTabId(id) || hiddenTabIds.has(id)) return;
      const href = replaceTabInUrl(pathname, searchParams, id);
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams, hiddenTabIds],
  );

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
        return;
      }
      event.preventDefault();
      const index = tabOrder.indexOf(active);
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabOrder.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabOrder.length) % tabOrder.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabOrder.length - 1;
      const nextId = tabOrder[next];
      selectTab(nextId);
      const button = document.getElementById(`sak-tab-${nextId}`);
      button?.focus();
    },
    [active, selectTab, tabOrder],
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
        {tabOrder.map((id) =>
          active === id ? (
            <motion.section
              key={id}
              id={`sak-fane-${id}`}
              role="tabpanel"
              aria-labelledby={`sak-tab-${id}`}
              tabIndex={0}
              className="space-y-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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