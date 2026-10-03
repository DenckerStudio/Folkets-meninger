'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LandingHeadingRule } from '@/components/icons/civic';
import { LandingTextSettle } from '@/components/landing-text-settle';
import { TextGradient } from '@/components/ui/text-gradient';

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

/** About / mission — typography-first (no cards). */
export default function AboutSection({
  eyebrow = 'Om oss',
  title,
  subtitle,
  missionTitle = 'Vår misjon',
  missionParagraphs,
  privacy,
  className,
}: AboutSectionProps) {
  return (
    <section id="om-oss" className={cn('scroll-mt-28', className)}>
      <div className="mx-auto max-w-3xl text-center">
        <LandingTextSettle>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">{eyebrow}</p>
        </LandingTextSettle>
        <LandingTextSettle>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl">
            <TextGradient as="span" colors={['#001433', '#ba0c2f', '#00205b', '#001433']} duration={7}>
              {title}
            </TextGradient>
          </h2>
          <LandingHeadingRule className="landing-heading-rule--center" />
        </LandingTextSettle>
        {subtitle ? (
          <LandingTextSettle>
            <p className="mt-5 text-lg leading-relaxed text-[#001433]/70">{subtitle}</p>
          </LandingTextSettle>
        ) : null}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <LandingTextSettle>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">
            {missionTitle}
          </h3>
        </LandingTextSettle>
        <div className="mt-6 space-y-6">
          {missionParagraphs.map((paragraph) => (
            <LandingTextSettle key={paragraph.slice(0, 40)}>
              <p className="text-xl leading-relaxed text-[#001433] sm:text-2xl sm:leading-relaxed">
                {paragraph}
              </p>
            </LandingTextSettle>
          ))}
        </div>
      </div>

      {privacy ? (
        <div className="mx-auto mt-20 max-w-3xl border-t border-[#00205b]/10 pt-12">
          <LandingTextSettle>
            <h3 className="text-2xl font-bold tracking-tight text-[#001433]">{privacy.title}</h3>
          </LandingTextSettle>
          <LandingTextSettle>
            <p className="mt-4 text-base leading-relaxed text-[#001433]/70">{privacy.intro}</p>
          </LandingTextSettle>
          <ul className="mt-8 space-y-5">
            {privacy.points.map((point) => (
              <li key={point.label}>
                <LandingTextSettle>
                  <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <span className="text-sm font-semibold text-[#00205b]">{point.label}</span>
                    <span className="text-base leading-relaxed text-[#001433]/70">{point.text}</span>
                  </div>
                </LandingTextSettle>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
