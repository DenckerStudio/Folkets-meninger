import { ALIGNMENT_MIN_FOLK_VOTES } from '@/lib/alignment/types';
import { GOVERNMENT_STATS_MIN_VOTES } from '@/lib/government-stats/snapshot';
import {
  STEMME_PLUS_BENEFITS,
  STEMME_PLUS_MONTHLY_PRICE_NOK,
  STEMME_PLUS_NON_INFLUENCE_NOTE,
} from '@/lib/stemme-plus/constants';
import { routes } from '@/lib/routes';

/** Stortinget open data base — used across lib/stortinget-*.ts */
export const STORTINGET_DATA_API = 'https://data.stortinget.no';

export const OM_INTRO =
  'Folkets Meninger lar deg følge saker fra Stortinget, si hva du mener, og sammenligne med faktiske voteringer — uten å være en offisiell meningsmåling for hele Norge.';

export const OM_WHY_POINTS = [
  {
    title: 'Kilden er alltid med',
    body:
      'Hver sak lenker til dokumentene og til saken på stortinget.no.',
  },
  {
    title: 'Si din mening',
    body:
      'Innloggede brukere kan stemme For, Mot eller Avstår på saker, delta i Ja/Nei/Blank-avstemninger og skrive strukturerte meninger i Folkets meninger.',
  },
  {
    title: 'Sammenlign med vedtak',
    body: `På sakssider viser vi «Folkets vilje vs. Stortinget» når voteringer finnes og minst ${ALIGNMENT_MIN_FOLK_VOTES} anonyme stemmer er avgitt i appen.`,
  },
] as const;

export const OM_PROCESS_STEPS = [
  {
    title: 'Utforsk saker',
    body: 'På Utforsk finner du saker som er til behandling og saker som er avgjort. Hver sak har dokumentene, og ofte et AI-sammendrag.',
  },
  {
    title: 'Stem og skriv',
    body: 'Logg inn for å stemme på saker (For/Mot/Avstår) og for å publisere meninger. Stemmer telles anonymt i statistikken.',
  },
  {
    title: 'Høringer',
    body: 'Se Stortingets høringer i appen og skriv kommentarer lokalt — de sendes ikke automatisk til Stortinget.',
  },
  {
    title: 'Avstemninger og Reels',
    body: 'I avstemningene svarer du ja, nei eller blank. På Utforsk finner du også korte Reels om sakene. Vi lager dem med AI ut fra saksdokumentene, og de er merket.',
  },
  {
    title: 'Valgomat',
    body: 'På Min side ser du hvilke partier du står nærmest, ut fra det du har svart. Det krever at vi har partidata for sakene.',
  },
] as const;

export const OM_DATA_SOURCES = [
  {
    label: 'Saker og voteringer',
    href: `${STORTINGET_DATA_API}/eksport/saker?format=json`,
    note: 'Hentes jevnlig fra Stortinget.',
  },
  {
    label: 'Høringer',
    href: `${STORTINGET_DATA_API}/eksport/horinger?format=json`,
    note: 'Hentes fra Stortinget og oppdateres hver time.',
  },
  {
    label: 'Offisielle dokumenter',
    href: 'https://www.stortinget.no/no/Saker-og-publikasjoner/',
    note: 'Vi lenker til dem, og viser dem i appen når Stortinget publiserer dem som HTML.',
  },
] as const;

export const OM_STAT_FACTS = [
  {
    label: 'Kilde',
    value: 'data.stortinget.no',
    detail: 'Lesing via åpent API — ingen egen «sannhetsmaskin».',
  },
  {
    label: 'Sammenligning',
    value: `${ALIGNMENT_MIN_FOLK_VOTES}+ stemmer`,
    detail: 'Før vi sammenligner folkets stemmer med en Stortinget-votering på sakssiden.',
  },
  {
    label: 'Offentlig statistikk',
    value: `${GOVERNMENT_STATS_MIN_VOTES}+ stemmer`,
    detail: 'Før saker inkluderes i anonyme aggregater på Innsikt.',
  },
  {
    label: 'Stemme+',
    value: `${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd`,
    detail: STEMME_PLUS_NON_INFLUENCE_NOTE,
  },
] as const;

export const OM_FAQ = [
  {
    id: 'representativitet',
    question: 'Er tallene representative for hele Norge?',
    answer:
      'Nei. Statistikken viser hva brukere av Folkets Meninger har stemt og skrevet — ikke et representativt utvalg av befolkningen. Vi merker aggregater som ikke-representative og viser antall stemmer der det er relevant.',
  },
  {
    id: 'noytralitet',
    question: 'Er appen nøytral og uavhengig?',
    answer:
      'Vi er ikke knyttet til Regjeringen eller Stortinget. Saksdata og komitéinnstillinger kommer fra Stortingets åpne kilder og vises med nøytral merking. AI-sammendrag er tydelig merket og kan rapporteres som skjevhet via innspill.',
  },
  {
    id: 'hvem',
    question: 'Hvem står bak Folkets Meninger?',
    answer:
      'Folkets Meninger er en uavhengig plattform (samme formulering som i offentlig statistikk i appen). Kontakt oss via innspill-skjemaet eller kontakt@folkets-meninger.no hvis du vil vite mer.',
  },
  {
    id: 'finansiering',
    question: 'Hvordan finansieres dette?',
    answer: `Grunnfunksjonene er gratis. Valgfritt Stemme+ (${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd via Stripe når det er konfigurert) gir støttemerke, rikere varsler og chat med egen LLM-nøkkel. ${STEMME_PLUS_NON_INFLUENCE_NOTE}`,
  },
] as const;

export const OM_FREE_FEATURES = [
  'Les saker, dokumenter og høringer',
  'Stem og si din mening (krever innlogging)',
  'Se statistikken på Innsikt',
] as const;

export const OM_STEMME_PLUS_FEATURES = [...STEMME_PLUS_BENEFITS] as const;

export const OM_PRIVACY_SNIPPET =
  'Hvor data ligger: Appen og databasen driftes på server i Norge. Betaling går via Stripe, som ligger utenfor Norge. Se listen over underleverandører på personvernsiden.';

export const OM_LINKS = {
  personvern: routes.personvern,
  omAi: routes.omAi,
  innspill: routes.innspill,
} as const;
