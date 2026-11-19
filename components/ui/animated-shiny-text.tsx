'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

type AnimatedShinyTextProps = {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
};

/**
 * Light glare that pans across inline text. Adapted from Magic UI /
 * 21st.dev Animated Shiny Text (dillionverma). Renders a span so it can sit
 * inside headings.
 */
export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 120,
}: AnimatedShinyTextProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <span
      style={{ '--shiny-width': `${shimmerWidth}px` } as CSSProperties}
      className={cn(
        'inline text-brand-accent',
        reduced
          ? null
          : [
              'animate-shiny-text bg-clip-text bg-no-repeat [background-size:var(--shiny-width)_100%]',
              'bg-gradient-to-r from-transparent via-white via-50% to-transparent',
            ],
        className,
      )}
    >
      {children}
    </span>
  );
}
