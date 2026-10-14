'use client';

import { useSyncExternalStore } from 'react';

function subscribe(query: string, onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * SSR-safe media query. `serverValue` is used during SSR and the first client
 * render so hydration stays consistent before the viewport is known.
 */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function useIsBelowLg() {
  return useMediaQuery('(max-width: 1023px)', true);
}
