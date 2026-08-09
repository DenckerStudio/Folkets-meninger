'use client';

import AboutSection from '@/components/ui/about-section';

/** Landing “Om oss” + misjon — typography-first, no cards. */
export function LandingAbout() {
  return (
    <AboutSection
      eyebrow="Om oss"
      title="Om Folkets Stemme"
      subtitle="Vi bygger bro mellom Stortinget og folket — med forståelige saker, åpen debatt og anonym innsikt politikere kan stole på."
      missionTitle="Vår misjon"
      missionParagraphs={[
        'Demokratiet stopper ikke på valgdagen. Mellom valgene fattes det tusenvis av beslutninger som påvirker skole, helse, klima og økonomi. Folkets Stemme finnes for at flere skal kunne følge med og bli hørt — uten å måtte være politisk nerd.',
        'Vi henter saker og dokumenter fra Stortingets åpne data, forklarer dem med AI-sammendrag, og samler mening, debatt og høringsinnspill på ett sted. Innlogging sikrer én stemme per person (MinID kommer senere); statistikken viser trender, ikke navn.',
        'Vi er nøytrale: verken Regjeringen eller Stortinget eier plattformen. Ambisjonen er et mer informert folk og politikere som lettere kan lytte til hva velgerne faktisk mener.',
      ]}
      privacy={{
        title: 'Personvern og sikkerhet',
        intro: (
          <>
            Å lagre politiske meninger innebærer behandling av sensitive personopplysninger. Vi bygger
            plattformen etter prinsippet om{' '}
            <strong className="text-[#001433]">innebygd personvern</strong>.
          </>
        ),
        points: [
          {
            label: 'Dataminimering',
            text: 'Vi lagrer kun det som er nødvendig for konto og stemmegivning.',
          },
          {
            label: 'Anonymisering',
            text: 'Stemmen lagres uten kobling til navn eller fødselsnummer.',
          },
          {
            label: 'Norsk lagring',
            text: 'Data lagres i Norge eller EU/EØS. Ingen data til tredjeland.',
          },
          {
            label: 'Sletting',
            text: 'Du kan slette profil og historikk når som helst.',
          },
        ],
      }}
    />
  );
}
