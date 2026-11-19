import { STANCE_AGGREGATE_DISCLOSURE } from '@/lib/copy/stance-privacy';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';

export const LANDING_HERO_H1_LINE_1 = 'Følg Stortinget.';
export const LANDING_HERO_H1_LINE_2 = 'Din mening mellom valgene.';
export const LANDING_HERO_H1_KEYWORD = 'mening';

export const LANDING_HERO_SUBHEAD = `Konkrete forslag fra Stortinget. Si din mening med ${pollBallotRunningTextPhrase()} — uten at navnet ditt følger med.`;

export const LANDING_HERO_PRIMARY_CTA = 'Si din mening';

export const LANDING_HERO_CARD_COPY =
  `Si din mening om sakene Stortinget behandler. ${STANCE_AGGREGATE_DISCLOSURE}`;

export const HOW_IT_WORKS_TITLE = 'Fra din mening til Stortinget';
export const HOW_IT_WORKS_KEYWORD = 'mening';
export const HOW_IT_WORKS_DESCRIPTION = 'Data fra Stortinget. Din mening, høring og innsikt.';

export const HOW_IT_WORKS_STEPS = [
  {
    title: 'Direkte fra Stortinget',
    description:
      'Lovforslag og representantforslag hentes ufiltrert fra Stortingets åpne API — kildedokumentene bak avstemningene.',
    colorTheme: 'red' as const,
  },
  {
    title: 'Si din mening',
    description: `Nasjonale spørsmål bruker ${pollBallotRunningTextPhrase()}. Meningen telles uten navn i samlet statistikk.`,
    colorTheme: 'blue' as const,
  },
  {
    title: 'Skriv meningen din',
    description: 'Høringer med navngitte innspill — del mening med fornavn og etternavn.',
    colorTheme: 'navy' as const,
  },
  {
    title: 'Se meningen samlet',
    description: 'Anonymisert statistikk viser hva brukerne mener — uten at navnet ditt vises.',
    colorTheme: 'red' as const,
  },
] as const;

export const LANDING_BENEFITS_EYEBROW = 'Det du får';
export const LANDING_BENEFITS_TITLE = 'Én konto. Din mening mellom valgene.';
export const LANDING_BENEFITS_TITLE_KEYWORD = 'mening';

export const LANDING_BENEFITS_LINES = [
  {
    text: 'Si meningen din om det Stortinget faktisk behandler.',
    highlight: 'meningen',
  },
  {
    text: 'Behold meningen din uten navn i statistikken.',
    highlight: 'meningen',
  },
  {
    text: 'Se om folket og Stortinget er enige — når nok har deltatt.',
    highlight: 'enige',
  },
] as const;

export const LANDING_CTA_TITLE = 'Vil du at meningen din skal synes?';
export const LANDING_CTA_TITLE_KEYWORD = 'meningen';
export const LANDING_CTA_SUBTITLE =
  'Opprett gratis konto på ett minutt. Én person, én mening — tallene vises bare samlet.';
export const LANDING_CTA_PRIMARY = 'Si din mening';

export const LANDING_FOOTER_TAGLINE = 'Uavhengig plattform for din mening og høringer.';

export const HOMEPAGE_DOCUMENT_TITLE = 'Folkets Meninger — din mening mellom valgene';
export const HOMEPAGE_OG_HEADLINE = 'Din mening teller.';

export const HVA_ER_ANNERLEDES_INTRO =
  'Vi er ikke en offisiell meningsmåling. Her er det som skiller Folkets Meninger fra en generell «si din mening i appen»-opplevelse.';
