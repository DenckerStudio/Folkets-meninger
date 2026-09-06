'use client';

import AboutSection from '@/components/ui/about-section';

/** Landing “Om oss” + misjon — typography-first, no cards. */
export function LandingAbout() {
  return (
    <AboutSection
      eyebrow="Om oss"
      title="Om Folkets Stemme"
      subtitle="En uavhengig plattform bygget for å gi innbyggerne en direkte stemme i løpende politiske saker."
      missionTitle="Vår misjon"
      missionParagraphs={[
        'Demokratiet stopper ikke på valgdagen. Mellom valgene fattes det tusenvis av beslutninger på Stortinget som påvirker hverdagen vår. Folkets Stemme ble skapt for å tette gapet mellom politikerne og folket i disse periodene.',
        'Vi henter saker direkte fra Stortingets åpne API, krever innlogging for å stemme, og viser kun anonym innsikt — slik at politikere ser trender, ikke personer.',
        'Vi tror at ærlig, anonym statistikk over hva velgerne mener om konkrete spørsmål fører til bedre beslutninger — og at innbyggere fortjener å bli hørt mellom valgene.',
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
