'use client';

import { Play } from 'lucide-react';
import { PRODUCT_TOUR_EVENT } from '@/lib/onboarding';

/** Replays the optional product tour from the current dashboard page. */
export function ProductTourRestart() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENT))}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:bg-muted/50"
    >
      <Play className="h-4 w-4 text-brand" aria-hidden />
      Vis omvisning igjen
    </button>
  );
}