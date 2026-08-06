'use client';

import { Database, Info, Shield } from 'lucide-react';
import AboutSection from '@/components/ui/about-section';

/** Landing “Om oss” + misjon, based on 21st.dev About Section. */
export function LandingAbout() {
  return (
    <AboutSection
      eyebrow="Om oss"
      title="Om Folkets Stemme"
      subtitle="En uavhengig plattform bygget for å styrke demokratiet ved å gi innbyggerne en direkte, verifisert stemme i løpende politiske saker."
      missionTitle="Vår misjon"
      missionParagraphs={[
        'Demokratiet stopper ikke på valgdagen. Mellom valgene fattes det tusenvis av beslutninger på Stortinget som påvirker hverdagen vår. Folkets Stemme ble skapt for å tette gapet mellom politikerne og folket i disse periodene.',
        'Vi tror at hvis politikere får tilgang til reell, verifisert statistikk over hva velgerne deres faktisk mener om konkrete saker, vil det føre til bedre og mer representative beslutninger. Samtidig gir det innbyggerne en følelse av å bli hørt.',
      ]}
      pillars={[
        {
          icon: Database,
          accent: 'blue',
          title: 'Data fra kilden',
          description:
            'Vi henter saker, forslag og voteringer direkte og ufiltrert fra Stortingets åpne API.',
        },
        {
          icon: Shield,
          accent: 'red',
          title: 'Sikker innlogging',
          description:
            'E-post, Google eller SMS. Én konto per person ved soft launch — BankID kommer senere.',
        },
        {
          icon: Info,
          accent: 'blue',
          title: 'Anonym innsikt',
          description: 'Stemmen kobles fra identiteten din. Politikere ser kun aggregerte trender.',
        },
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
