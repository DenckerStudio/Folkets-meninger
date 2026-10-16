'use client';

import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useRevealInView } from '@/hooks/use-reveal-in-view';
import { cn } from '@/lib/utils';
import { LandingHeadingRule } from '@/components/icons/civic';
import { SoftBlurIn } from '@/components/ui/soft-blur-in';
import { TextGradient } from '@/components/ui/text-gradient';
import { TextReveal } from '@/components/ui/text-reveal';

export type AboutPrivacyPoint = {
  label: string;
  text: string;
};

export type AboutSectionProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  missionTitle?: string;
  missionParagraphs: string[];
  privacy?: {
    title: string;
    intro: ReactNode;
    points: AboutPrivacyPoint[];
  };
  className?: string;
};

/** 21st.dev Reveal / Blur Fade — expo-out, short travel. */
const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;

const privacyBlockVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.04,
    },
  },
};

const privacyListVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const privacyItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: SMOOTH_EASE,
    },
  },
};

/**
 * About / mission — typography-first (no cards).
 * Uses 21st.dev text components: TextGradient, SoftBlurIn, TextReveal.
 */
export default function AboutSection({
  eyebrow = 'Om oss',
  title,
  subtitle,
  missionTitle = 'Vår misjon',
  missionParagraphs,
  privacy,
  className,
}: AboutSectionProps) {
  const reduceMotion = useReducedMotion();
  const { ref: privacyRef, revealed: privacyRevealed } = useRevealInView<HTMLDivElement>({
    amount: 0.15,
  });

  return (
    <section id="om-oss" className={cn('scroll-mt-28', className)}>
      <div className="mx-auto max-w-3xl text-center">
        <SoftBlurIn>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">{eyebrow}</p>
        </SoftBlurIn>
        <SoftBlurIn delay={0.08}>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl">
            <TextGradient as="span" colors={['#001433', '#ba0c2f', '#00205b', '#001433']} duration={7}>
              {title}
            </TextGradient>
          </h2>
          <LandingHeadingRule className="landing-heading-rule--center" />
        </SoftBlurIn>
        {subtitle ? (
          <SoftBlurIn delay={0.14}>
            <p className="mt-5 text-lg leading-relaxed text-[#001433]/70">{subtitle}</p>
          </SoftBlurIn>
        ) : null}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <SoftBlurIn>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">
            {missionTitle}
          </h3>
        </SoftBlurIn>
        <div className="mt-6 space-y-6">
          {missionParagraphs.map((paragraph) => (
            <TextReveal
              key={paragraph.slice(0, 40)}
              text={paragraph}
              by="word"
              stagger={0.05}
              maxDuration={1.7}
              amount={0.2}
              className="text-xl leading-relaxed text-[#001433] sm:text-2xl sm:leading-relaxed"
            />
          ))}
        </div>
      </div>

      {privacy ? (
        <LazyMotion features={domAnimation}>
          <m.div
            ref={privacyRef}
            className="mx-auto mt-20 max-w-3xl border-t border-[#00205b]/10 pt-12"
            initial={reduceMotion ? 'visible' : 'hidden'}
            animate={reduceMotion || privacyRevealed ? 'visible' : 'hidden'}
            variants={privacyBlockVariants}
          >
            <m.h3
              variants={reduceMotion ? undefined : privacyItemVariants}
              className="text-2xl font-bold tracking-tight text-[#001433]"
            >
              {privacy.title}
            </m.h3>
            <m.p
              variants={reduceMotion ? undefined : privacyItemVariants}
              className="mt-4 text-base leading-relaxed text-[#001433]/70"
            >
              {privacy.intro}
            </m.p>
            <m.ul
              className="mt-8 space-y-5"
              variants={reduceMotion ? undefined : privacyListVariants}
            >
              {privacy.points.map((point) => (
                <m.li
                  key={point.label}
                  variants={reduceMotion ? undefined : privacyItemVariants}
                  className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-6"
                >
                  <span className="text-sm font-semibold text-[#00205b]">{point.label}</span>
                  <span className="text-base leading-relaxed text-[#001433]/70">{point.text}</span>
                </m.li>
              ))}
            </m.ul>
          </m.div>
        </LazyMotion>
      ) : null}
    </section>
  );
}
