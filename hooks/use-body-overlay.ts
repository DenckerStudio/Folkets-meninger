'use client';

import { useEffect } from 'react';

let overlayCount = 0;

function syncAttribute() {
  if (typeof document === 'undefined') return;
  if (overlayCount > 0) {
    document.body.dataset.overlayOpen = 'true';
  } else {
    delete document.body.dataset.overlayOpen;
  }
}

/**
 * Marks the body while an overlay (dialog, drawer, sheet, popover) is open so
 * floating chrome like the chat orb can hide. Counts nested overlays safely.
 */
export function useBodyOverlayFlag(active: boolean) {
  useEffect(() => {
    if (!active) return;
    overlayCount += 1;
    syncAttribute();
    return () => {
      overlayCount = Math.max(0, overlayCount - 1);
      syncAttribute();
    };
  }, [active]);
}
