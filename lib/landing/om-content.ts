import { ALIGNMENT_MIN_FOLK_VOTES } from '@/lib/alignment/types';
import { DATA_CONTROLLER, formatDataControllerBlock } from '@/lib/legal/controller';
import { STANCE_AGGREGATE_DISCLOSURE } from '@/lib/copy/stance-privacy';
import { GOVERNMENT_STATS_MIN_VOTES } from '@/lib/government-stats/snapshot';
import {
  STEMME_PLUS_BENEFITS,
  STEMME_PLUS_MONTHLY_PRICE_NOK,
  STEMME_PLUS_NON_INFLUENCE_NOTE,
} from '@/lib/stemme-plus/constants';
import { TRUST_HOSTING_SUMMARY } from '@/lib/trust/subprocessors';
import { routes } from '@/lib/routes';

/** Stortinget open data base — used across lib/stortinget-*.ts */
export const STORTINGET_DATA_API = 'https://data.stortinget.no';

export const OM_INTRO =
  'Folkets Meninger lar deg følge saker fra Stortinget, si hva du mener, og sammenligne med faktiske voteringer — uten å være en offisiell meningsmåling for hele Norge.';

export const OM_WHY_POINTS = [
  {
    title: 'Følg Stortinget',
    body:
      'Saker, dokumenter og høringer hentes fra Stortingets åpne API. Du kan lese kildene og åpne saken på stortinget.no.',
  },
  {
    title: 'Si din mening',
    body:
      'Innloggede brukere kan stemme For, Mot eller Avstår på saker, delta i Ja/Nei/Blank-avstemninger og skrive strukturerte meninger i Folkets meninger.',
  },
  {
    title: 'Sammenlign med vedtak',
    body: `På sakssider viser vi «Folkets vilje vs. Stortinget» når voteringer finnes og minst ${ALIGNMENT_MIN_FOLK_VOTES} stemmer er avgitt i appen (samlet, uten navn).`,
  },
] as const;

export const OM_PROCESS_STEPS = [
  {
    title: 'Utforsk saker',
    body: 'Se aktuelle og behandlede saker på Utforsk og åpne sakssider med dokumenter og AI-sammendrag når det finnes.',
  },
  {
    title: 'Stem og skriv',
    body: `Logg inn for å markere holdning på saker, delta i avstemninger og publisere meninger. ${STANCE_AGGREGATE_DISCLOSURE}`,
  },
  {
    title: 'Høringer',
    body: 'Se Stortingets høringer i appen og skriv kommentarer lokalt — de sendes ikke automatisk til Stortinget.',
  },
  {
    title: 'Avstemninger og Reels',
    body: 'Ja/Nei/Blank-avstemninger og systemgenererte Reels på Utforsk. Reels-utkast lages av admin fra saksdokumenter (AI), merket som systemgenerert.',
  },
  {
    title: 'Valgomat 2.0',
    body: 'På Min side kan du markere holdninger og se partimatch basert på det du har stemt — når partidata finnes i appen.',
  },
] as const;

export const OM_DATA_SOURCES = [
  {
    label: 'Saker og voteringer',
    href: `${STORTINGET_DATA_API}/eksport/saker?format=json`,
    note: 'Sakslister og detaljer hentes fra Stortingets åpne API og holdes oppdatert i appen.',
  },
  {
    label: 'Høringer',
    href: `${STORTINGET_DATA_API}/eksport/horinger?format=json`,
    note: 'Høringer hentes fra Stortingets åpne API og oppdateres jevnlig.',
  },
  {
    label: 'Offisielle dokumenter',
    href: 'https://www.stortinget.no/no/Saker-og-publikasjoner/',
    note: 'Lenker og dokumentvisning der Stortinget publiserer dem.',
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
    answer: `Folkets Meninger drives av ${formatDataControllerBlock() ?? 'Dencker (enkeltpersonforetak), org.nr. 934538498'}. Vi er ikke knyttet til Regjeringen eller Stortinget. Kontakt oss via innspill-skjemaet eller ${DATA_CONTROLLER.privacyEmail} hvis du vil vite mer.`,
  },
  {
    id: 'finansiering',
    question: 'Hvordan finansieres dette?',
    answer: `Grunnfunksjonene er gratis. Valgfritt Stemme+ (${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd når betaling er aktivert) gir støttemerke, rikere varsler og chat med din egen språkmodellnøkkel. ${STEMME_PLUS_NON_INFLUENCE_NOTE}`,
  },
] as const;

export const OM_FREE_FEATURES = [
  'Les saker, dokumenter og høringer',
  'Stem på saker og avstemninger (innlogging)',
  'Folkets meninger og offentlig statistikk med ærlige terskler',
] as const;

export const OM_STEMME_PLUS_FEATURES = [...STEMME_PLUS_BENEFITS] as const;

export const OM_PRIVACY_SNIPPET = TRUST_HOSTING_SUMMARY;

export const OM_LINKS = {
  personvern: routes.personvern,
  omAi: routes.omAi,
  innspill: routes.innspill,
  blogg: routes.blogg,
} as const;
