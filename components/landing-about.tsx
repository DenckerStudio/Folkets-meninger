'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, Cpu, Landmark, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { InnspillForm } from '@/components/innspill-form';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { BentoFeatureGrid } from '@/components/ui/bento-feature-grid';
import { LandingFaqAccordion } from '@/components/ui/landing-faq-accordion';
import { LandingFactStats } from '@/components/ui/landing-fact-stats';
import { LandingProcessTimeline } from '@/components/ui/landing-process-timeline';
import { SoftBlurIn } from '@/components/ui/soft-blur-in';
import { TextReveal } from '@/components/ui/text-reveal';
import {
  OM_DATA_SOURCES,
  OM_FAQ,
  OM_FREE_FEATURES,
  OM_INTRO,
  OM_LINKS,
  OM_PRIVACY_SNIPPET,
  OM_PROCESS_STEPS,
  OM_STAT_FACTS,
  OM_STEMME_PLUS_FEATURES,
  OM_WHY_POINTS,
  STORTINGET_DATA_API,
} from '@/lib/landing/om-content';
import { STEMME_PLUS_MONTHLY_PRICE_NOK, STEMME_PLUS_NON_INFLUENCE_NOTE } from '@/lib/stemme-plus/constants';
import { PLATFORM_AI_PIPELINES } from '@/lib/trust/ai-transparency';
import { cn } from '@/lib/utils';

function SectionBlock({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-20 border-t border-[#00205b]/10 pt-16 first:mt-0 first:border-t-0 first:pt-0', className)}>
      <SoftBlurIn>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#001433] sm:text-3xl">{title}</h3>
        <LandingHeadingRule />
      </SoftBlurIn>
      <SoftBlurIn delay={0.1} className="mt-8">
        {children}
      </SoftBlurIn>
    </div>
  );
}

/** Landing «Om Folkets Meninger» — expanded section with 21st-inspired blocks. */
export function LandingAbout() {
  const whyTiles = OM_WHY_POINTS.map((point, i) => ({
    icon: [Landmark, Scale, BookOpen][i] ?? Landmark,
    title: point.title,
    body: point.body,
    accentClassName: i === 1 ? 'text-[#ba0c2f]' : 'text-[#00205b]',
    className: i === 0 ? 'sm:col-span-2' : undefined,
  }));

  const summaryModels = PLATFORM_AI_PIPELINES
    .filter((row) => row.feature.includes('Saksammendrag') || row.feature.includes('Reels'))
    .map((row) => row.model)
    .join(' · ');

  return (
    <LandingSectionContainer>
      <section id="om-oss" className="scroll-mt-28">
        <div className="mx-auto max-w-3xl text-center">
          <SoftBlurIn>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Om oss</p>
          </SoftBlurIn>
          <SoftBlurIn delay={0.08}>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl">
              Om Folkets Meninger
            </h2>
            <LandingHeadingRule className="landing-heading-rule--center" />
          </SoftBlurIn>
          <SoftBlurIn delay={0.14}>
            <TextReveal
              text={OM_INTRO}
              className="mt-5 text-lg leading-relaxed text-[#001433]/70"
              amount={0.2}
              stagger={0.04}
            />
          </SoftBlurIn>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <BentoFeatureGrid tiles={whyTiles} />
        </div>

        <SectionBlock eyebrow="Slik fungerer det" title="Fra sak til din stemme">
          <div className="mx-auto max-w-2xl">
            <LandingProcessTimeline steps={OM_PROCESS_STEPS} />
          </div>
        </SectionBlock>

        <SectionBlock eyebrow="Tall vi står for" title="Åpne terskler, ikke påstander">
          <LandingFactStats items={OM_STAT_FACTS} />
        </SectionBlock>

        <SectionBlock eyebrow="Datakilder" title="Hvor informasjonen kommer fra">
          <ul className="space-y-4">
            {OM_DATA_SOURCES.map((source) => (
              <li
                key={source.label}
                className="rounded-xl border border-[#00205b]/10 bg-white p-4 shadow-sm"
              >
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
                >
                  {source.label}
                </a>
                <p className="mt-1 text-sm text-[#001433]/65">{source.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[#001433]/60">
            API-base:{' '}
            <a
              href={STORTINGET_DATA_API}
              className="font-medium text-[#00205b] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {STORTINGET_DATA_API}
            </a>
          </p>
        </SectionBlock>

        <SectionBlock eyebrow="Nøytralitet og AI" title="Kilder først, modeller merket">
          <div className="flex gap-4 rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm">
            <Cpu className="mt-0.5 h-6 w-6 shrink-0 text-[#00205b]" aria-hidden />
            <div className="space-y-3 text-sm leading-relaxed text-[#001433]/75">
              <p>
                Saksammendrag og system-Reels lages av språkmodeller som kjører på våre egne servere, ikke i
                nettleseren din. Modellfamiliene vi bruker er blant annet {summaryModels || 'se dokumentasjon'}.
              </p>
              <p>
                Sammendrag merkes «AI-generert» med lenker til Stortinget-dokumenter. Konsekvens-kalkulatoren
                bygger på dokumentutdrag og lagret sammendrag uten å kalle en språkmodell.
              </p>
              <Link
                href={OM_LINKS.omAi}
                className="inline-flex font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
              >
                Les mer om AI og modeller →
              </Link>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock eyebrow="Personvern" title="Drift og lagring">
          <div className="flex gap-4 rounded-2xl border border-[#00205b]/10 bg-[#00205b]/[0.03] p-6">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#ba0c2f]" aria-hidden />
            <div className="space-y-3 text-sm leading-relaxed text-[#001433]/75">
              <p className="text-base font-medium text-[#001433]">{OM_PRIVACY_SNIPPET}</p>
              <p>
                Holdninger og avstemninger lagres på kontoen din; offentlige tall er bare aggregater uten navn.
                Du kan be om innsyn og sletting via innspill eller e-post, eller trekke samtykke under Min side.
              </p>
              <Link
                href={OM_LINKS.personvern}
                className="inline-flex font-semibold text-[#00205b] underline-offset-2 hover:text-[#ba0c2f] hover:underline"
              >
                Personvern og underleverandører →
              </Link>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock eyebrow="Gratis og Stemme+" title="Demokrati først, støtte valgfritt">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#00205b]/10 bg-white p-6 shadow-sm">
              <h4 className="text-lg font-semibold text-[#001433]">Gratis</h4>
              <ul className="mt-4 space-y-2 text-sm text-[#001433]/70">
                {OM_FREE_FEATURES.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-[#ba0c2f]" aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#ba0c2f]/25 bg-[#ba0c2f]/[0.04] p-6 shadow-sm">
              <h4 className="flex items-center gap-2 text-lg font-semibold text-[#001433]">
                <Sparkles className="h-5 w-5 text-[#ba0c2f]" aria-hidden />
                Stemme+ ({STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd)
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-[#001433]/70">
                {OM_STEMME_PLUS_FEATURES.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-[#ba0c2f]" aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-medium text-[#001433]">{STEMME_PLUS_NON_INFLUENCE_NOTE}</p>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock eyebrow="FAQ" title="Spørsmål vi ofte får">
          <LandingFaqAccordion items={OM_FAQ} />
        </SectionBlock>

        <div id="om-kontakt" className="mt-20 scroll-mt-28 border-t border-[#00205b]/10 pt-16">
          <SoftBlurIn>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Kontakt</p>
            <h3 className="mt-3 text-2xl font-bold text-[#001433]">Gi innspill</h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#001433]/70">
              Idé, feil, spørsmål om representativitet eller nøytralitet? Samme skjema som på{' '}
              <Link href={OM_LINKS.innspill} className="font-medium text-[#00205b] hover:underline">
                /innspill
              </Link>
              .
            </p>
          </SoftBlurIn>
          <SoftBlurIn delay={0.12} className="mx-auto mt-8 max-w-xl">
            <InnspillForm />
          </SoftBlurIn>
        </div>
      </section>
    </LandingSectionContainer>
  );
}
