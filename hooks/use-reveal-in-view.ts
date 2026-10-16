'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

const FALLBACK_MS = 2200;

type UseRevealInViewOptions = {
  amount?: number;
  once?: boolean;
  /** Safety net if IntersectionObserver never fires. */
  fallbackMs?: number;
};

/**
 * Scroll reveal trigger with prefers-reduced-motion and a timer fallback so content
 * never stays hidden when the observer misses.
 */
export function useRevealInView<T extends Element = HTMLElement>({
  amount = 0.2,
  once = true,
  fallbackMs = FALLBACK_MS,
}: UseRevealInViewOptions = {}) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<T | null>(null);
  const inView = useInView(ref, { once, amount });
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setFallback(true), fallbackMs);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, fallbackMs]);

  const revealed = Boolean(reducedMotion) || inView || fallback;

  return { ref, revealed, reducedMotion: Boolean(reducedMotion) };
}
