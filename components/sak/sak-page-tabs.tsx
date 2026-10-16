'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

export const SAK_PAGE_TAB_IDS = [
  'oversikt',
  'dokumenter',
  'for-deg',
] as const;

export type SakPageTabId = (typeof SAK_PAGE_TAB_IDS)[number];

const TAB_LABELS: Record<SakPageTabId, string> = {
  oversikt: 'Oversikt',
  dokumenter: 'Dokumenter',
  'for-deg': 'For deg',
};

const TAB_CHANGE_EVENT = 'sak-tab-change';

function isSakPageTabId(value: string): value is SakPageTabId {
  return (SAK_PAGE_TAB_IDS as readonly string[]).includes(value);
}

function tabFromHash(): SakPageTabId {
  if (typeof window === 'undefined') return 'oversikt';
  const hash = window.location.hash.replace(/^#/, '');
  return isSakPageTabId(hash) ? hash : 'oversikt';
}

function dispatchTabChange() {
  window.dispatchEvent(new Event(TAB_CHANGE_EVENT));
}

export function navigateToSakTab(id: SakPageTabId) {
  const nextHash = `#${id}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', nextHash);
  }
  dispatchTabChange();
}

function subscribeToTab(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(TAB_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(TAB_CHANGE_EVENT, onChange);
  };
}

const TABS = SAK_PAGE_TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id] })) as readonly {
  id: SakPageTabId;
  label: string;
}[];

export function SakPageTabs({
  oversikt,
  dokumenter,
  forDeg,
}: {
  oversikt: ReactNode;
  dokumenter: ReactNode;
  forDeg: ReactNode;
}) {
  const active = useSyncExternalStore(subscribeToTab, tabFromHash, () => 'oversikt');
  const reducedMotion = usePrefersReducedMotion();

  const selectTab = useCallback((id: string) => {
    if (isSakPageTabId(id)) navigateToSakTab(id);
  }, []);

  const panels: Record<SakPageTabId, ReactNode> = {
    oversikt,
    dokumenter,
    'for-deg': forDeg,
  };

  return (
    <div className="space-y-6">
      <nav
        className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:px-0"
        aria-label="Saksseksjoner"
      >
        <AnimatedTabs
          tabs={TABS}
          activeId={active}
          onSelect={selectTab}
          layoutId="sak-page-tabs"
          idPrefix="sak-tab"
          className="w-max min-w-full sm:w-auto sm:min-w-0"
          tabClassName="shrink-0 text-xs sm:text-sm"
        />
      </nav>

      <AnimatePresence mode="wait">
        {SAK_PAGE_TAB_IDS.map((id) =>
          active === id ? (
            <motion.section
              key={id}
              id={id}
              role="tabpanel"
              aria-labelledby={`sak-tab-${id}`}
              className="space-y-6"
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
