/** Brukervennlige forklaringer for saksgang og metadata fra Stortinget. */

export {
  classifySakKind,
  getSakKindLabel,
  type SakKind,
} from './stortinget-sak-presentation';

export const SAK_EVENT_TOOLTIPS: Record<string, string> = {
  FRADEP:
    'Forslaget eller dokumentet er sendt inn fra et departement (regjeringen). Dette er ofte starten på et lovforslag.',
  FRAREP:
    'Forslaget kommer fra en eller flere stortingsrepresentanter, for eksempel et representantforslag.',
  SAK: 'Saken er opprettet i Stortingets system og får et saksnummer.',
  FREMMET:
    'Saken er offisielt lagt frem i Stortinget. Fra dette tidspunktet behandles den formelt av Stortinget.',
  REFS: 'Saken er omtalt eller referert til i et stortingsmøte, uten at det nødvendigvis er tatt en avgjørelse.',
  SENDT:
    'Saken er sendt til en stortingskomité som skal vurdere innholdet og ofte skrive en innstilling til Stortinget.',
  KOMITE:
    'Komiteen behandler saken. De kan holde høringer, stille spørsmål til departementet og utarbeide en anbefaling.',
  HOERFRIST: 'Fristen for å sende inn høringssvar er satt. Da kan organisasjoner og enkeltpersoner gi innspill.',
  HOER: 'Det holdes høring om saken, der interesserte parter kan komme med synspunkter før Stortinget avgjør.',
  ORDFORER:
    'En saksordfører fra komiteen er valgt. Vedkommende leder arbeidet med saken og presenterer komiteens vurdering.',
  INNST:
    'Komiteen har levert sin innstilling — en anbefaling til Stortinget om hva som bør vedtas.',
  BEHS: 'Stortinget har behandlet saken i salen, for eksempel gjennom debatt eller votering.',
  PLBEHS: 'Det er satt en dato for når Stortinget planlegger å behandle saken.',
  VOT: 'Stortinget stemmer over forslaget. Resultatet viser om flertallet er for eller mot.',
  VEDTAK: 'Stortinget har fattet et vedtak i saken — altså bestemt hva som skal skje videre.',
  DEBATT: 'Representantene debatterer saken i Stortingssalen før eventuell votering.',
  LOV: 'Loven er vedtatt av Stortinget og kan tre i kraft etter eventuell kongelig assent.',
};

export const SAK_STEP_TOOLTIPS: Record<string, string> = {
  'I komité': 'Komiteen vurderer saken grundig før Stortinget tar endelig stilling.',
  'Første behandling': 'Stortinget tar saken opp til diskusjon for første gang.',
  'Andre behandling': 'Stortinget behandler saken på nytt, ofte med endringer fra komiteen.',
  'Tredje behandling': 'Siste runde i lovprosessen før endelig votering.',
  Vedtak: 'Stortinget fatte et endelig vedtak i saken.',
};

export const SAK_META_TOOLTIPS = {
  saksnummer:
    'Unikt nummer for saken i inneværende stortingssesjon. Brukes for å finne saken på stortinget.no.',
  dokumentreferanse:
    'Offisiell referanse til dokumentet, for eksempel «Prop. 103 L» (lovforslag) eller «Dokument 8» (representantforslag).',
  komite:
    'Stortingskomiteen som har ansvar for å vurdere saken og gi en innstilling til hele Stortinget.',
  forslagstillere:
    'De som har fremmet forslaget — enten regjeringen (via departement) eller stortingsrepresentanter.',
  saksordfoerer:
    'Representant utpekt av komiteen til å følge saken og presentere komiteens syn i Stortinget.',
  saksgang:
    'Tidslinjen viser hvilke steg saken har vært gjennom — fra den ble fremmet til eventuelt vedtak.',
  innstilling:
    'Komiteens tekstforslag til hva Stortinget bør beslutte. Les dette for å forstå hva som anbefales.',
  kortvedtak: 'Kort oppsummering av hva Stortinget faktisk vedtok i saken.',
  vedtakstekst: 'Den fulle teksten til vedtaket Stortinget har fattet.',
  lovforslag:
    'Forslag fra regjeringen om å endre eller innføre en lov. Stortinget må stemme for at det skal gjelde.',
  representantforslag:
    'Forslag fra én eller flere representanter om at Stortinget eller regjeringen skal gjøre noe bestemt.',
  underBehandling: 'Saken er fortsatt aktiv i Stortinget og er ikke ferdig avgjort.',
  ferdigbehandlet: 'Saken er avsluttet i Stortinget. Den kan fortsatt være relevant som historikk.',
} as const;

export function getSakEventTooltip(eventId: string | null | undefined, label?: string | null): string | null {
  if (eventId && SAK_EVENT_TOOLTIPS[eventId]) {
    return SAK_EVENT_TOOLTIPS[eventId];
  }

  if (label) {
    for (const [step, tooltip] of Object.entries(SAK_STEP_TOOLTIPS)) {
      if (label.toLowerCase().includes(step.toLowerCase())) {
        return tooltip;
      }
    }
  }

  return null;
}

export function getSakStepTooltip(stepName: string): string | null {
  const normalized = stepName.trim();
  if (SAK_STEP_TOOLTIPS[normalized]) {
    return SAK_STEP_TOOLTIPS[normalized];
  }

  for (const [key, tooltip] of Object.entries(SAK_STEP_TOOLTIPS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return tooltip;
    }
  }

  return null;
}
