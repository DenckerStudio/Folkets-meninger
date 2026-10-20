'use client';

import Link from 'next/link';
import { HeartHandshake, Megaphone, Scale, ShieldCheck } from 'lucide-react';
import { LandingSectionContainer } from '@/components/landing-section-container';
import { LandingHeadingRule } from '@/components/icons/civic';
import { BentoFeatureGrid } from '@/components/ui/bento-feature-grid';
import { SoftBlurIn } from '@/components/ui/soft-blur-in';
import { TextReveal } from '@/components/ui/text-reveal';
import { STEMME_PLUS_MONTHLY_PRICE_NOK, STEMME_PLUS_NON_INFLUENCE_NOTE } from '@/lib/stemme-plus/constants';
import { routes } from '@/lib/routes';

const INTRO =
  'Vi er ikke en offisiell meningsmåling. Her er det som skiller Folkets Meninger fra en generell «stem i appen»-opplevelse.';

export function LandingHvaErAnnerledes() {
  const tiles = [
    {
      icon: Megaphone,
      title: 'Høringer og innspill',
      accentClassName: 'text-[#ba0c2f]',
      className: 'sm:col-span-2',
      body: (
        <>
          Se Stortingets høringer og skriv kommentarer i appen — de sendes ikke automatisk til Stortinget. I{' '}
          <Link
            href={routes.folketsMeninger}
            className="font-medium text-[#00205b] underline underline-offset-4"
          >
            Folkets Meninger
          </Link>{' '}
          kan du formulere meninger og samle støtte til høringsinnspill du selv kan bruke videre.
        </>
      ),
    },
    {
      icon: Scale,
      title: 'Sammenlign med faktiske vedtak',
      accentClassName: 'text-[#00205b]',
      body: (
        <>
          På sakssider viser vi «Folkets vilje vs. Stortinget» når voteringer finnes: anonyme holdninger i appen
          opp mot offisielle tall fra Stortinget — merket som ikke-representative.
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: 'Anonymitet i statistikken',
      accentClassName: 'text-[#00205b]',
      body: (
        <>
          Offentlige tall viser aldri hvem som stemte. Høringer og navngitte meninger krever identitet der
          Stortinget eller fellesskapet trenger det.
        </>
      ),
    },
    {
      icon: HeartHandshake,
      title: `Stemme+ (${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd)`,
      accentClassName: 'text-[#ba0c2f]',
      className: 'sm:col-span-2',
      body: (
        <>
          Valgfritt støttemedlemskap gir merker, rikere varsler og mulighet til å bruke din egen språkmodell-tilgang.{' '}
          {STEMME_PLUS_NON_INFLUENCE_NOTE}
        </>
      ),
    },
  ];

  return (
    <LandingSectionContainer>
      <section id="hva-er-annerledes" className="scroll-mt-28">
        <div className="mx-auto max-w-3xl text-center">
          <SoftBlurIn>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ba0c2f]">Slik skiller vi oss ut</p>
          </SoftBlurIn>
          <SoftBlurIn delay={0.08}>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001433] sm:text-4xl md:text-5xl">
              Hva er annerledes?
            </h2>
            <LandingHeadingRule className="landing-heading-rule--center" />
          </SoftBlurIn>
          <SoftBlurIn delay={0.14}>
            <TextReveal
              text={INTRO}
              className="mt-5 text-lg leading-relaxed text-[#001433]/70"
              amount={0.2}
              stagger={0.045}
            />
          </SoftBlurIn>
        </div>

        <SoftBlurIn delay={0.2} className="mx-auto mt-12 max-w-5xl">
          <BentoFeatureGrid tiles={tiles} tileGapClassName="gap-0" tileContentClassName="mt-3" />
        </SoftBlurIn>

        <SoftBlurIn delay={0.28} className="mt-8 text-center text-sm text-[#001433]/60">
          <Link href={routes.personvern} className="font-medium text-[#00205b] hover:text-[#ba0c2f]">
            Personvern og infrastruktur
          </Link>
          {' · '}
          <Link href={routes.omAi} className="font-medium text-[#00205b] hover:text-[#ba0c2f]">
            Språkmodeller og data
          </Link>
        </SoftBlurIn>
      </section>
    </LandingSectionContainer>
  );
}
