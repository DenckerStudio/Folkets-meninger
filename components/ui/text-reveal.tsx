'use client';

import { Fragment, useMemo } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRevealInView } from '@/hooks/use-reveal-in-view';

const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;
const UNIT_DURATION = 0.55;

const HIDDEN = { opacity: 0, y: 8 } as const;
const SHOWN = { opacity: 1, y: 0 } as const;

export type TextRevealSplit = 'word' | 'character';

type TextRevealUnit = {
  key: string;
  text: string;
  index: number;
};

type TextRevealGroup = {
  key: string;
  units: TextRevealUnit[];
};

export type TextRevealProps = {
  text: string;
  className?: string;
  /** Extra delay before the first unit starts (seconds). */
  delay?: number;
  by?: TextRevealSplit;
  /** Target stagger between units; compressed so total stays under maxDuration. */
  stagger?: number;
  /** Cap total reveal length for long paragraphs (seconds). */
  maxDuration?: number;
  startOnView?: boolean;
  once?: boolean;
  /** Fraction of element that must be visible before reveal starts. */
  amount?: number;
  as?: 'p' | 'h2' | 'h3' | 'span';
};

/**
 * Staggered in-view text reveal: opacity + small rise, ease-out (~400–700ms per unit).
 */
export function TextReveal({
  text,
  className,
  delay = 0,
  by = 'word',
  stagger = 0.055,
  maxDuration = 1.8,
  startOnView = true,
  once = true,
  amount = 0.2,
  as: Tag = 'p',
}: TextRevealProps) {
  const reduced = useReducedMotion();
  const { ref, revealed: inViewRevealed } = useRevealInView<HTMLSpanElement>({ amount, once });
  const started = !startOnView || inViewRevealed;

  const { groups, step } = useMemo(() => {
    const words = text.trim().length ? text.trim().split(/\s+/) : [];

    let index = 0;
    const built: TextRevealGroup[] = words.map((word, w) => {
      if (by === 'character') {
        return {
          key: `w${w}`,
          units: Array.from(word).map((char, c) => ({
            key: `w${w}c${c}`,
            text: char,
            index: index++,
          })),
        };
      }
      return {
        key: `w${w}`,
        units: [{ key: `w${w}`, text: word, index: index++ }],
      };
    });

    const total = index;
    const span = Math.max(0, maxDuration - UNIT_DURATION);

    return {
      groups: built,
      step: total > 1 ? Math.min(stagger, span / (total - 1)) : 0,
    };
  }, [text, by, stagger, maxDuration]);

  return (
    <LazyMotion features={domAnimation}>
      <Tag className={cn(className)}>
        <span className="sr-only">{text}</span>
        <span ref={ref} aria-hidden="true">
          {groups.map((group, g) => (
            <Fragment key={group.key}>
              {g > 0 ? ' ' : null}
              <span className="inline-block whitespace-nowrap align-baseline">
                {group.units.map((unit) => (
                  <m.span
                    key={unit.key}
                    className="inline-block align-baseline"
                    initial={reduced ? SHOWN : HIDDEN}
                    animate={started || reduced ? SHOWN : HIDDEN}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            duration: UNIT_DURATION,
                            ease: EASE_OUT,
                            delay: started ? delay + unit.index * step : 0,
                          }
                    }
                  >
                    {unit.text}
                  </m.span>
                ))}
              </span>
            </Fragment>
          ))}
        </span>
      </Tag>
    </LazyMotion>
  );
}
