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
      'Lokal LLM for saksammendrag (qwen3:4b-q4_K_M), systempoll-utkast (gemma4:e2b-it-qat) og embeddings (nomic-embed-text:v1.5).',
    hosting: 'Self-hosted på Coolify — server i Norge (n8n kaller Ollama; ikke fra Next.js direkte).',
    codeRef: 'workflows/n8n/ai-summary-backfill.workflow.ts, document-embeddings.workflow.ts',
  },
  {
    name: 'SearXNG',
    purpose: 'Metasøk for Stemme+ chat (kildesøk utenfor Stortinget) via SEARXNG_BASE_URL.',
    hosting:
      'Self-hosted på Coolify (standard i kode: https://searxng.heyklever.app — kan overstyres i env).',
    codeRef: 'lib/chat/searxng.ts, .env.example',
  },
];

/**Eksterne tjenester utenfor norsk server — listes separat med hosting. */
export const TRUST_THIRD_PARTY_PROVIDERS: SubprocessorRow[] = [
  {
    name: 'Cloudflare',
    purpose:
      'Proxy/CDN for supabase.heyklever.app, n8n, Ollama og SearXNG (*.heyklever.app). Hoveddomenet www.folkets-meninger.no går ikke via Cloudflare.',
    hosting: 'Cloudflare Inc. (globalt edge-nettverk; hovedkontor i USA).',
    codeRef: 'NEXT_PUBLIC_SUPABASE_URL, workflows/n8n/, lib/chat/searxng.ts',
  },
  {
    name: 'Stripe',
    purpose:
      'Valgfritt abonnement Stemme+ (Checkout, kundeportal og webhooks) når STRIPE_* er konfigurert.',
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
    name: 'SMTP-leverandør',
    purpose: 'Velkomst- og varsel-e-post når SMTP_* env er satt.',
    hosting: 'Avhenger av valgt SMTP_HOST (konfigureres i miljø; ikke hardkodet i repo).',
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
  'Ingen tredjeparts analytics-bibliotek (f.eks. Google Analytics eller Vercel Analytics) finnes i package.json eller app/layout.tsx. Serverlogger kan finnes på Coolify-serveren i Norge.';

export const TRUST_VERCEL_NOTE =
  'Produksjon kjører ikke på Vercel. Cron-jobs går via n8n (ikke Vercel Cron). Koden kan lese VERCEL_URL/VERCEL_ENV for delingslenker på eventuelle preview-bygg; det er ikke en produksjonstjeneste vi er avhengige av.';
