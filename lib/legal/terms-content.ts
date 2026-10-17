import { MIN_ACCOUNT_AGE_YEARS } from '@/lib/legal/account-age';
import { formatDataControllerBlock } from '@/lib/legal/controller';

export const TERMS_UPDATED = '17. oktober 2026';

export function buildTermsIntro(): string {
  const controller = formatDataControllerBlock();
  const who = controller ?? 'Folkets Meninger';
  return `${who} tilbyr en uavhengig plattform for å følge Stortinget og dele meninger. Ved å opprette konto godtar du disse vilkårene.`;
}

export const TERMS_SECTIONS = [
  {
    title: 'Hvem kan bruke tjenesten',
    body: `Du må være minst ${MIN_ACCOUNT_AGE_YEARS} år for å registrere deg. Vi gjennomfører ikke alderskontroll utover det du bekrefter ved registrering.`,
  },
  {
    title: 'Din bruk',
    body:
      'Du er ansvarlig for innhold du publiserer og for å holde innloggingen din trygg. Ikke misbruk tjenesten, ikke forsøk å omgå tekniske begrensninger, og følg norsk lov.',
  },
  {
    title: 'Personvern',
    body:
      'Behandling av personopplysninger beskrives i personvernerklæringen. Politiske holdninger og stemmer behandles bare med uttrykkelig samtykke.',
  },
  {
    title: 'Stemme+',
    body:
      'Valgfritt abonnement kan tilbys mot betaling når betalingsløsning er aktivert. Pris og innhold fremgår i appen før kjøp.',
  },
  {
    title: 'Ansvarsfraskrivelse',
    body:
      'Tjenesten er ikke en offisiell meningsmåling og representerer ikke Stortinget eller regjeringen. Aggregerte tall er ikke statistisk representative for hele befolkningen.',
  },
] as const;
