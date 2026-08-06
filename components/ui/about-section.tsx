'use client';

import type { ComponentType, ReactNode } from 'react';
import { LazyMotion, domAnimation, m } from 'motion/react';
import { cn } from '@/lib/utils';

export type AboutPillar = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent?: 'red' | 'blue';
};

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
  pillars: AboutPillar[];
  privacy?: {
    title: string;
    intro: ReactNode;
    points: AboutPrivacyPoint[];
  };
  className?: string;
};

/**
 * About Section (21st.dev / UI Layouts AboutSection3-style).
 * Mission narrative, value pillars, and optional privacy block.
 */
export default function AboutSection({
  eyebrow = 'Om oss',
  title,
  subtitle,
  missionTitle = 'Vår misjon',
  missionParagraphs,
  pillars,
  privacy,
  className,
}: AboutSectionProps) {
  return (
    <section id="om-oss" className={cn('scroll-mt-28', className)}>
      <LazyMotion features={domAnimation}>
        <div className="mx-auto max-w-3xl text-center">
          <m.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]"
          >
            {eyebrow}
          </m.p>
          <m.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-3 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl"
          >
            {title}
          </m.h2>
          {subtitle ? (
            <m.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mt-4 text-lg leading-relaxed text-[#001433]/65"
            >
              {subtitle}
            </m.p>
          ) : null}
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-12 rounded-3xl border border-[#00205b]/12 bg-white p-8 md:p-11"
        >
          <h3 className="text-2xl font-bold text-[#001433]">{missionTitle}</h3>
          <div className="mt-4 space-y-4 text-lg leading-relaxed text-[#001433]/70">
            {missionParagraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        </m.div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            const accent = pillar.accent ?? (index === 1 ? 'red' : 'blue');
            const iconTone =
              accent === 'red'
                ? 'border-[#ba0c2f]/20 bg-[#ba0c2f]/[0.06] text-[#ba0c2f] group-hover:border-[#ba0c2f] group-hover:bg-[#ba0c2f] group-hover:text-white'
                : 'border-[#00205b]/15 bg-[#00205b]/[0.06] text-[#00205b] group-hover:border-[#00205b] group-hover:bg-[#00205b] group-hover:text-white';

            return (
              <m.article
                key={pillar.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: 0.06 * index }}
                className="group rounded-2xl border border-[#00205b]/10 bg-white p-7 text-center transition-all hover:border-[#00205b]/30 hover:shadow-[0_8px_30px_rgba(0,32,91,0.06)]"
              >
                <div
                  className={cn(
                    'mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border transition-colors',
                    iconTone,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#001433]">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#001433]/65">{pillar.description}</p>
              </m.article>
            );
          })}
        </div>

        {privacy ? (
          <m.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mt-8 rounded-3xl border border-[#00205b]/12 bg-gradient-to-br from-[#00205b]/[0.04] via-white to-[#ba0c2f]/[0.05] p-8 md:p-11"
          >
            <h3 className="text-2xl font-bold text-[#001433]">{privacy.title}</h3>
            <div className="mt-4 space-y-5 leading-relaxed text-[#001433]/70">
              <p>{privacy.intro}</p>
              <ul className="space-y-3">
                {privacy.points.map((point) => (
                  <li key={point.label} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ba0c2f]" aria-hidden />
                    <span>
                      <strong className="text-[#001433]">{point.label}:</strong> {point.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </m.div>
        ) : null}
      </LazyMotion>
    </section>
  );
}
