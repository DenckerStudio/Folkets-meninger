import { MIN_ACCOUNT_AGE_YEARS } from '@/lib/legal/account-age';
import { STANCE_PUBLIC_MIN_ENGAGED } from '@/lib/stances/constants';
import { GOVERNMENT_STATS_MIN_VOTES } from '@/lib/government-stats/snapshot';

export const PRIVACY_NOTICE_UPDATED = '17. oktober 2026';

export const PRIVACY_PROCESSING_TABLE = [
  {
    purpose: 'Opprette og drifte kontoen din',
    data: 'Navn, e-post, passord (kryptert), eventuell Google-ID, eventuelt telefonnummer',
    legalBasis: 'Avtale (GDPR art. 6(1)(b))',
    retention: 'Til du sletter kontoen',
  },
  {
    purpose: 'Lagre holdninger, stemmer og valgomat',
    data: 'Holdning per sak, stemmer i avstemninger, emneprofil',
    legalBasis: 'Uttrykkelig samtykke (art. 9(2)(a) og 6(1)(a))',
    retention: 'Til du trekker samtykket eller sletter kontoen',
  },
  {
    purpose: 'Publisere meninger og innspill med navn',
    data: 'Navn, tekst, standpunkt',
    legalBasis: 'Samtykke / du har selv offentliggjort (art. 9(2)(a)/(e))',
    retention: 'Til du sletter innlegget eller kontoen',
  },
  {
    purpose: 'Fylkesstatistikk i avstemninger',
    data: 'Fylke (selvvalgt)',
    legalBasis: 'Samtykke (art. 6(1)(a))',
    retention: 'Til du endrer eller sletter',
  },
  {
    purpose: 'Varsler på e-post',
    data: 'E-post, preferanser, saker du følger',
    legalBasis: 'Avtale / samtykke for markedsføring i digest',
    retention: 'Til du skrur av eller sletter kontoen',
  },
  {
    purpose: 'Stemme+ og betaling',
    data: 'Stripe kunde-ID, abonnementsstatus',
    legalBasis: 'Avtale (art. 6(1)(b)); regnskapsplikt (art. 6(1)(c))',
    retention: 'Abonnementsdata til du avslutter; regnskapsdata etter bokføringsloven',
  },
  {
    purpose: 'AI-chat med egen nøkkel (BYOK)',
    data: 'Kryptert API-nøkkel, meldinger, holdninger hvis du samtykker og ber om det',
    legalBasis: 'Avtale + uttrykkelig samtykke for holdningsdata',
    retention: 'Nøkkel til du sletter den; samtaler lagres i nettleseren din',
  },
  {
    purpose: 'Sikkerhet og misbruk',
    data: 'IP (midlertidig), serverlogger, user agent ved tilbakemelding',
    legalBasis: 'Berettiget interesse (art. 6(1)(f))',
    retention: 'Kortvarig i driftslogger (konfigureres på server)',
  },
  {
    purpose: 'Anonym statistikk',
    data: `Aggregater (minst ${STANCE_PUBLIC_MIN_ENGAGED} / ${GOVERNMENT_STATS_MIN_VOTES} svar der det gjelder)`,
    legalBasis: 'Ikke personopplysninger etter aggregering',
    retention: 'Løpende aggregater',
  },
] as const;

export const PRIVACY_RECIPIENTS_INTRO =
  'Vi bruker databehandlere der det er nødvendig. Hovednettstedet driftes på server i Norge. Database, automatisering og AI-tjenester kan gå via Cloudflare (USA-selskap). Betaling (Stripe), innlogging (Google) og eventuelle BYOK-leverandører du velger kan behandle data utenfor Norge.';

export const PRIVACY_TRANSFERS =
  'Overføring utenfor EU/EØS kan skje til Cloudflare, Stripe, Google, OpenAI, xAI og andre BYOK-leverandører. Overføringen bygger på EU–US Data Privacy Framework der leverandøren er sertifisert, ellers standardavtaler (art. 46). Verifiser DPA per leverandør.';

export const PRIVACY_RIGHTS =
  'Du har rett til innsyn, retting, sletting, begrensning, dataportabilitet og til å protestere mot behandling basert på berettiget interesse. Du kan når som helst trekke tilbake samtykke uten at det påvirker lovligheten av behandlingen før tilbaketrekkingen. Bruk Min side → Personvern for samtykke og sletting av holdningsdata, eller kontakt oss. Vi svarer innen én måned.';

export const PRIVACY_COMPLAINT =
  'Du kan klage til Datatilsynet (www.datatilsynet.no, Postboks 458 Sentrum, 0105 Oslo).';

export const PRIVACY_COOKIES =
  'Vi bruker informasjonskapsler som er nødvendige for innlogging (Supabase auth-token), og lokal lagring for tema, omvisning, utkast, konsekvenskalkulator og chat-samtaler i nettleseren. Vi bruker ikke tredjeparts analyseverktøy på forsiden.';

export const PRIVACY_AGE = `Du må være minst ${MIN_ACCOUNT_AGE_YEARS} år for å opprette konto. Vi gjennomfører ikke aldersverifisering utover det du bekrefter ved registrering.`;
