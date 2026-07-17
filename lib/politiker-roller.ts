export type PolitikerRolleInfo = {
  title: string;
  description: string;
};

const REpresentantRolle: PolitikerRolleInfo = {
  title: 'Stortingsrepresentant',
  description:
    'Valgt av innbyggerne i sitt valgdistrikt. Representerer velgerne i Stortinget, deltar i debatter og voteringer, kan fremme representantforslag og kontrollere regjeringen.',
};

const ROLLER: Record<string, PolitikerRolleInfo> = {
  Statsminister: {
    title: 'Statsminister',
    description:
      'Regjeringens leder og Norges regjeringssjef. Leder regjeringens arbeid, presenterer lovforslag og statsbudsjett for Stortinget, og representerer Norge nasjonalt og internasjonalt.',
  },
  Utenriksminister: {
    title: 'Utenriksminister',
    description:
      'Ansvarlig for Norges utenrikspolitikk, diplomati og internasjonale relasjoner. Forhandler avtaler, representerer Norge i EU/EØS og andre internasjonale fora, og koordinerer utenrikstjenesten.',
  },
  Finansminister: {
    title: 'Finansminister',
    description:
      'Leder arbeidet med statsbudsjettet, skattepolitikk og den økonomiske styringen av landet. Fremskriver statsbudsjettet og proposisjoner om økonomi, skatt og forvaltning.',
  },
  Forsvarsminister: {
    title: 'Forsvarsminister',
    description:
      'Ansvarlig for Forsvaret, militær beredskap og nasjonal sikkerhet. Legger frem forsvarspolitikk og proposisjoner om Forsvaret og beredskap for Stortinget.',
  },
  'Justis- og beredskapsminister': {
    title: 'Justis- og beredskapsminister',
    description:
      'Ansvarlig for politi, domstoler, straffegjennomføring, innvandring og samfunnssikkerhet. Fremmer lover og regler om rettsvesen, kriminalitet og beredskap.',
  },
  'Helse- og omsorgsminister': {
    title: 'Helse- og omsorgsminister',
    description:
      'Ansvarlig for spesialisthelsetjenesten, folkehelse og omsorgspolitikk. Styrer helseforetak, legger frem lovforslag om helse og omsorg, og fordeler helsemidler.',
  },
  Kunnskapsminister: {
    title: 'Kunnskapsminister',
    description:
      'Ansvarlig for grunnskole, videregående skole og fagskoler. Setter rammer for læreplaner, skolestruktur og kvalitet i grunnopplæringen.',
  },
  'Forskning- og høyere utdanningsminister': {
    title: 'Forskning- og høyere utdanningsminister',
    description:
      'Ansvarlig for universiteter, høyskoler, forskningspolitikk og studentvelferd. Fordeler forskningsmidler og legger til rette for høyere utdannelse og innovasjon.',
  },
  'Klima- og miljøminister': {
    title: 'Klima- og miljøminister',
    description:
      'Ansvarlig for klimapolitikk, naturmangfold, forurensningskontroll og friluftsliv. Fremmer lover og tiltak for å nå klima- og miljømål.',
  },
  Energiminister: {
    title: 'Energiminister',
    description:
      'Ansvarlig for energipolitikk, kraftforsyning, petroleum og fornybar energi. Balanserer sikker energiforsyning med klima- og næringspolitiske hensyn.',
  },
  Næringsminister: {
    title: 'Næringsminister',
    description:
      'Ansvarlig for næringsliv, konkurranseevne, havbruk og regional næringsutvikling. Fremmer rammevilkår for bedrifter, innovasjon og eksport.',
  },
  Samferdselsminister: {
    title: 'Samferdselsminister',
    description:
      'Ansvarlig for veier, jernbane, luftfart, havner og kollektivtransport. Planlegger og prioriterer infrastrukturprosjekter og transportpolitikk.',
  },
  'Fiskeri- og havminister': {
    title: 'Fiskeri- og havminister',
    description:
      'Ansvarlig for fiskerinæring, havbruk og forvaltning av marine ressurser. Regulerer kvoter og fremmer bærekraftig bruk av havet.',
  },
  'Landbruks- og matminister': {
    title: 'Landbruks- og matminister',
    description:
      'Ansvarlig for landbruk, matproduksjon og distriktspolitikk knyttet til matforsyning. Styrer jordbruksstøtte og matsikkerhet.',
  },
  'Kommunal- og distriktsminister': {
    title: 'Kommunal- og distriktsminister',
    description:
      'Ansvarlig for kommunenes økonomi, regional utvikling og distriktspolitikk. Fordeler statlige rammer til kommuner og fylkeskommuner.',
  },
  'Kultur- og likestillingsminister': {
    title: 'Kultur- og likestillingsminister',
    description:
      'Ansvarlig for kultur, idrett, medier og likestillingspolitikk. Fordeler kulturstøtte og fremmer mangfold og deltakelse i kulturlivet.',
  },
  'Barne- og familieminister': {
    title: 'Barne- og familieminister',
    description:
      'Ansvarlig for barnehager, barnevern, familiepolitikk og likestilling i hverdagen. Fremmer barns rettigheter og foreldres støtteordninger.',
  },
  'Arbeids- og inkluderingsminister': {
    title: 'Arbeids- og inkluderingsminister',
    description:
      'Ansvarlig for arbeidsmarked, integrering, NAV og inkludering i arbeidslivet. Styrer arbeidslivsregler og tiltak mot utenforskap.',
  },
  'Digitaliserings- og forvaltningsminister': {
    title: 'Digitaliserings- og forvaltningsminister',
    description:
      'Ansvarlig for digitalisering av offentlig sektor, IKT-politikk og modernisering av forvaltningen. Fremmer effektive digitale tjenester for innbyggere.',
  },
  Utviklingsminister: {
    title: 'Utviklingsminister',
    description:
      'Ansvarlig for bistand, globale utviklingsmål og humanitær innsats. Fordeler norske bistandsmidler og fremmer bærekraftig utvikling i lavinntektsland.',
  },
};

function normalizeRoleKey(tittel: string): string {
  return tittel.trim().toLowerCase();
}

const ROLLER_BY_NORMALIZED = Object.fromEntries(
  Object.entries(ROLLER).map(([key, value]) => [normalizeRoleKey(key), value]),
);

export function getPolitikerRolleInfo(
  tittel: string | undefined,
  erRegjeringsmedlem: boolean,
): PolitikerRolleInfo {
  if (tittel) {
    const match = ROLLER_BY_NORMALIZED[normalizeRoleKey(tittel)];
    if (match) return match;
  }

  if (erRegjeringsmedlem) {
    return {
      title: tittel || 'Statsråd',
      description:
        'Medlem av regjeringen med ansvar for et departement. Fremmer lovforslag og proposisjoner innen sitt fagområde og representerer regjeringen i Stortinget.',
    };
  }

  return REpresentantRolle;
}
