import { useSyncExternalStore } from 'react';

/** Returns false during SSR and the first client render, then true after mount. */
export function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
