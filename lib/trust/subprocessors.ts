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
 * Kjører på samme self-hosted Coolify-stack (ikke separate SaaS-hostere for app/DB).
 */
export const TRUST_COOLIFY_STACK: SubprocessorRow[] = [
  {
    name: 'Next.js-appen',
    purpose:
      'Nettside, dashboard, API-ruter (/api/*), middleware og autentisering mot databasen.',
    hosting: 'Self-hosted via Coolify — server i Norge.',
    codeRef: 'package.json, app/, middleware.ts',
  },
  {
    name: 'Database (PostgreSQL / Supabase-stack)',
    purpose:
      'Lagring av kontoer, stemmer, holdninger, avstemninger, saksdata, dokument-chunks og AI-sammendrag. RLS og RPC-er kjører her.',
    hosting: 'Self-hosted via Coolify — server i Norge (Supabase-klient i appen peker på dette prosjektet).',
    codeRef: 'NEXT_PUBLIC_SUPABASE_URL, supabase/migrations/',
  },
  {
    name: 'n8n',
    purpose:
      'Automatisering: AI-sammendrag, dokument-embeddings, systempoll-utkast, cron mot /api/cron/*, pipeline-health.',
    hosting: 'Self-hosted på Coolify — server i Norge.',
    codeRef: 'workflows/n8n/, .env.example (N8N_*_WEBHOOK_URL)',
  },
  {
    name: 'Ollama',
    purpose:
      'Språkmodeller som kjører lokalt på våre servere for saksammendrag (qwen3), systempoll-utkast (gemma4) og søk i dokumenter (nomic-embed-text).',
    hosting: 'Self-hosted via Coolify — server i Norge.',
    codeRef: 'workflows/n8n/ai-summary-backfill.workflow.ts, document-embeddings.workflow.ts',
  },
  {
    name: 'SearXNG',
    purpose: 'Kildesøk på nettet for Stemme+ chat.',
    hosting: 'Self-hosted via Coolify — server i Norge.',
    codeRef: 'lib/chat/searxng.ts, .env.example',
  },
];

/**Eksterne tjenester utenfor norsk server — listes separat med hosting. */
export const TRUST_THIRD_PARTY_PROVIDERS: SubprocessorRow[] = [
  {
    name: 'Cloudflare',
    purpose:
      'Proxy og CDN foran våre interne tjenester (database, automatiserings- og modelltjenester). Hoveddomenet www.folkets-meninger.no går ikke via Cloudflare.',
    hosting: 'Cloudflare Inc. (globalt edge-nettverk; hovedkontor i USA).',
    codeRef: 'NEXT_PUBLIC_SUPABASE_URL, workflows/n8n/, lib/chat/searxng.ts',
  },
  {
    name: 'Stripe',
    purpose:
      'Valgfritt abonnement Stemme+ (betaling, kundeportal og kvitteringer) når betaling er aktivert.',
    hosting: 'Stripe (internasjonal betalingsplattform; typisk USA/EU avhengig av produkt og DPA).',
    codeRef: 'app/api/stemme-plus/, app/api/webhooks/stripe/, lib/stripe/',
  },
  {
    name: 'Google (OAuth)',
    purpose: 'Valgfri innlogging via Supabase Auth (Google som OAuth-provider).',
    hosting: 'Google (globalt; databehandling via Google og Supabase Auth-konfigurasjon).',
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
      'Stemme+ kan lagre kryptert API-nøkkel og sende chat (og holdninger du samtykker til) til Google, OpenAI, xAI, Ollama, Anthropic eller annen gateway du velger.',
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

export const TRUST_VERCEL_NOTE =
  'Produksjonen kjører på våre egne servere i Norge, ikke hos Vercel. Planlagte oppgaver styres av vårt eget automatiseringssystem.';
