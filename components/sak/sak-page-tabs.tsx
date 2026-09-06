'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const SAK_PAGE_TAB_IDS = [
  'oversikt',
  'dokumenter',
  'for-deg',
  'motforslag',
  'diskusjon',
] as const;

export type SakPageTabId = (typeof SAK_PAGE_TAB_IDS)[number];

const TAB_LABELS: Record<SakPageTabId, string> = {
  oversikt: 'Oversikt',
  dokumenter: 'Dokumenter',
  'for-deg': 'For deg',
  motforslag: 'Motforslag',
  diskusjon: 'Diskusjon',
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

function subscribeToTab(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(TAB_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(TAB_CHANGE_EVENT, onChange);
  };
}

export function SakPageTabs({
  oversikt,
  dokumenter,
  forDeg,
  motforslag,
  diskusjon,
}: {
  oversikt: ReactNode;
  dokumenter: ReactNode;
  forDeg: ReactNode;
  motforslag: ReactNode;
  diskusjon: ReactNode;
}) {
  const active = useSyncExternalStore(subscribeToTab, tabFromHash, () => 'oversikt');

  const selectTab = useCallback((id: SakPageTabId) => {
    const nextHash = `#${id}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
    window.dispatchEvent(new Event(TAB_CHANGE_EVENT));
  }, []);

  const panels: Record<SakPageTabId, ReactNode> = {
    oversikt,
    dokumenter,
    'for-deg': forDeg,
    motforslag,
    diskusjon,
  };

  return (
    <div className="space-y-6">
      <nav
        className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-0 sm:px-0"
        aria-label="Saksseksjoner"
      >
        <div className="flex min-w-max gap-1 rounded-xl border border-border bg-muted/40 p-1" role="tablist">
          {SAK_PAGE_TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`sak-tab-${id}`}
              onClick={() => selectTab(id)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                active === id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-selected={active === id}
              aria-controls={id}
              tabIndex={active === id ? 0 : -1}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </nav>

      {SAK_PAGE_TAB_IDS.map((id) => (
        <section
          key={id}
          id={id}
          role="tabpanel"
          aria-labelledby={`sak-tab-${id}`}
          hidden={active !== id}
          className={active === id ? 'space-y-6' : 'hidden'}
        >
          {panels[id]}
        </section>
      ))}
    </div>
  );
}
