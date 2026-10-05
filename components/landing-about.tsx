'use client';

import AboutSection from '@/components/ui/about-section';

/** Landing “Om oss” + misjon — typography-first, no cards. */
export function LandingAbout() {
  return (
    <AboutSection
      eyebrow="Om oss"
      title="Om Folkets Stemme"
      subtitle="En direkte stemme i løpende politiske saker."
      missionTitle="Vår misjon"
      missionParagraphs={[
        'Mellom valgene fattes tusenvis av beslutninger på Stortinget. Folkets Stemme tetter gapet mellom politikerne og folket i den perioden.',
        'Vi henter saker fra Stortingets åpne API, krever innlogging for å stemme, og viser kun anonym innsikt — trender, ikke personer.',
        'Ærlig statistikk over hva velgerne mener om konkrete spørsmål gir bedre beslutninger.',
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
