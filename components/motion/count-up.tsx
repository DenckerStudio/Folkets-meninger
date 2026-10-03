'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { formatNumber } from '@/lib/utils';

type CountUpProps = {
  value: number;
  className?: string;
};

export function CountUp({ value, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;

    const start = performance.now();
    const duration = 720;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reducedMotion, value]);

  const visible = reducedMotion ? value : shown;

  return (
    <span ref={ref} className={className}>
      {formatNumber(visible)}
    </span>
  );
}
