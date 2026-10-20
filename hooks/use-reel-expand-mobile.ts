'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia('(max-width: 639px)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia('(max-width: 639px)').matches;
}

/** Reels expand fullscreen layout below 640px viewport width. */
export function useReelExpandMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
