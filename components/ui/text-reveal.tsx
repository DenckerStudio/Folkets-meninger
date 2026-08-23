'use client';

import { Fragment, useMemo, useRef } from 'react';
import { LazyMotion, domAnimation, m, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/** 21st.dev / ddoemonn Text Reveal — expo-out unblur. */
const EASE = [0.16, 1, 0.3, 1] as const;
const DURATION = 0.6;

const HIDDEN = { opacity: 0, y: 10, filter: 'blur(8px)' } as const;
const SHOWN = { opacity: 1, y: 0, filter: 'blur(0px)' } as const;

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
  /** Target stagger between units; compressed so total stay under maxDuration. */
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
 * Text Reveal (21st.dev / ddoemonn).
 * One scroll trigger → staggered blur-and-slide per word (or character).
 * Caps duration so long body copy stays readable.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
  by = 'word',
  stagger = 0.045,
  maxDuration = 1.5,
  startOnView = true,
  once = true,
  amount = 0.35,
  as: Tag = 'p',
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduced = useReducedMotion();

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
    const span = Math.max(0, maxDuration - DURATION);

    return {
      groups: built,
      step: total > 1 ? Math.min(stagger, span / (total - 1)) : 0,
    };
  }, [text, by, stagger, maxDuration]);

  const started = !startOnView || inView;

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
                    initial={reduced ? false : HIDDEN}
                    animate={started || reduced ? SHOWN : HIDDEN}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            duration: DURATION,
                            ease: EASE,
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
