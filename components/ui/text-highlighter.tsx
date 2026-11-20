'use client';

import type { CSSProperties, ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useRevealInView } from '@/hooks/use-reveal-in-view';
import { cn } from '@/lib/utils';

type TextHighlighterProps = {
  children: ReactNode;
  className?: string;
  /** Marker fill behind the word. */
  highlightColor?: string;
};

const DEFAULT_HIGHLIGHT = 'color-mix(in oklab, var(--brand-accent) 28%, white)';

/**
 * Marker-style highlight that sweeps in once when the word is in view.
 * Adapted from 21st.dev Text Highlighter (danielpetho).
 */
export function TextHighlighter({
  children,
  className,
  highlightColor = DEFAULT_HIGHLIGHT,
}: TextHighlighterProps) {
  const reduced = useReducedMotion();
  const { ref, revealed } = useRevealInView<HTMLSpanElement>({ amount: 0.4, once: true });

  const highlightStyle: CSSProperties = {
    backgroundImage: `linear-gradient(${highlightColor}, ${highlightColor})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0% 0%',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };

  const shown = '100% 100%';
  const hidden = '0% 100%';
  const active = Boolean(reduced) || revealed;

  return (
    <LazyMotion features={domAnimation}>
      <span ref={ref} className={cn('inline rounded-[0.28em] px-0.5', className)}>
        <m.span
          className="inline"
          style={highlightStyle}
          initial={{ backgroundSize: reduced ? shown : hidden }}
          animate={{ backgroundSize: active ? shown : hidden }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', duration: 0.9, bounce: 0, delay: 0.12 }
          }
        >
          {children}
        </m.span>
      </span>
    </LazyMotion>
  );
}
