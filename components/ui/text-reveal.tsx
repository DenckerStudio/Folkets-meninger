'use client';

import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

type TextRevealProps = {
  text: string;
  className?: string;
  delay?: number;
  as?: 'p' | 'h2' | 'h3' | 'span';
};

/**
 * Text Reveal (21st.dev text-component pattern).
 * Word-by-word fade/slide for readable, animated body copy.
 */
export function TextReveal({
  text,
  className,
  delay = 0,
  as: Tag = 'p',
}: TextRevealProps) {
  const reduceMotion = useReducedMotion();
  const words = text.trim().split(/\s+/);

  return (
    <LazyMotion features={domAnimation}>
      <Tag className={cn('flex flex-wrap gap-x-[0.35em] gap-y-1', className)}>
        {words.map((word, index) => (
          <m.span
            key={`${word}-${index}`}
            className="inline-block"
            initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{
              duration: 0.35,
              delay: delay + index * 0.018,
              ease: 'easeOut',
            }}
          >
            {word}
          </m.span>
        ))}
      </Tag>
    </LazyMotion>
  );
}
