/**
 * Underleverandører verifisert fra app-kode, env og workflows (okt. 2026).
 */

export type SubprocessorRow = {
  name: string;
  purpose: string;
  hosting: string;
  /** Where we found this in the repo (for maintainers). */
  codeRef: string;
};

/** Vises øverst på personvern-siden — bekreftet av eier (Mathias, okt. 2026). */
export const TRUST_HOSTING_SUMMARY =
  'Appen og databasen driftes på server i Norge.';

/**
 * Tjenester som kjører på våre egne servere (ikke separate SaaS-hostere for app/DB).
 */
export const TRUST_COOLIFY_STACK: SubprocessorRow[] = [
  {
    name: 'Folkets Meninger (nettjeneste)',
    purpose:
      'Nettside og dashboard der du leser saker, stemmer, skriver meninger og bruker avstemninger. Innlogging og sikkerhet håndteres her.',
    hosting: 'Egne servere i Norge.',
    codeRef: 'package.json, app/, middleware.ts',
  },
  {
    name: 'Database på våre egne servere i Norge',
    purpose:
      'Lagring av kontoer, stemmer, holdninger, avstemninger, saksdata, dokumentutdrag og AI-sammendrag.',
    hosting: 'Egne servere i Norge.',
    codeRef: 'NEXT_PUBLIC_SUPABASE_URL, supabase/migrations/',
  },
  {
    name: 'Automatiserte datajobber',
    purpose:
      'Planlagte jobber som henter og oppdaterer data fra Stortinget, lager AI-sammendrag, forbereder søk i dokumenter og systemgenererte avstemninger.',
    hosting: 'Egne servere i Norge.',
    codeRef: 'workflows/n8n/, .env.example (N8N_*_WEBHOOK_URL)',
  },
  {
    name: 'Språkmodell (eget oppsett)',
    purpose:
      'En språkmodell på våre egne servere i Norge brukes til saksammendrag, utkast til systemavstemninger og søk i saksdokumenter.',
    hosting: 'Egne servere i Norge.',
    codeRef: 'workflows/n8n/ai-summary-backfill.workflow.ts, document-embeddings.workflow.ts',
  },
  {
    name: 'Kildesøk på nettet',
    purpose: 'Hjelper Stemme+-chat med å finne oppdaterte kilder utenfor Stortingets åpne data.',
    hosting: 'Egne servere i Norge.',
    codeRef: 'lib/chat/searxng.ts, .env.example',
  },
];

/**Eksterne tjenester utenfor norsk server — listes separat med hosting. */
export const TRUST_THIRD_PARTY_PROVIDERS: SubprocessorRow[] = [
  {
    name: 'Stripe',
    purpose:
      'Valgfritt abonnement Stemme+ (betaling, kundeportal og kvitteringer) når betaling er aktivert.',
    hosting: 'Stripe (internasjonal betalingsplattform; typisk USA/EU avhengig av produkt og DPA).',
    codeRef: 'app/api/stemme-plus/, app/api/webhooks/stripe/, lib/stripe/',
  },
  {
    name: 'Google (OAuth)',
    purpose: 'Valgfri innlogging via Google-konto (OAuth).',
    hosting: 'Google (globalt; databehandling via Google og innloggingsoppsettet).',
    codeRef: 'app/auth/login/login-client.tsx',
  },
  {
    name: 'Stortinget (data.stortinget.no)',
    purpose: 'Offentlig API for saker, dokumenter, voteringer og høringer — kun lesing i appen.',
    hosting: 'Stortingets tjenester i Norge.',
    codeRef: 'lib/stortinget*.ts',
  },
  {
    name: 'E-postleverandør',
    purpose: 'Velkomst- og varsel-e-post når e-postvarsler er aktivert.',
    hosting: 'Avhenger av valgt e-postleverandør.',
    codeRef: '.env.example, lib/email/',
  },
  {
    name: 'Brukerens egen LLM-leverandør (BYOK)',
    purpose:
      'Stemme+ kan lagre kryptert API-nøkkel og sende chat (og holdninger du samtykker til) til leverandøren du velger (for eksempel OpenAI, Anthropic, Google eller annen kompatibel tjeneste).',
    hosting: 'Der leverandøren hoster modellen (ofte USA/EU; utenfor vår kontroll).',
    codeRef: 'lib/byok/, user_llm_credentials, lib/chat/personal-tools.ts',
  },
];

/** @deprecated Bruk TRUST_COOLIFY_STACK og TRUST_THIRD_PARTY_PROVIDERS */
export const TRUST_SUBPROCESSORS: SubprocessorRow[] = [
  ...TRUST_COOLIFY_STACK,
  ...TRUST_THIRD_PARTY_PROVIDERS,
];

export const TRUST_ANALYTICS_NOTE =
  'Vi bruker ikke tredjeparts analyseverktøy (som Google Analytics). Det kan finnes tekniske serverlogger på vår egen server i Norge.';
