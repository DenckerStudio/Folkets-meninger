# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, marking personal issue stances, voting in Ja/Nei/Blank
polls, and sharing public input through Folkets meninger, motforslag, høringer,
and sak-scoped discussion. The app reads public Stortinget data from
`data.stortinget.no`, stores app state in Supabase, and delegates AI summaries,
document embeddings, app cron jobs, and system-poll drafts to n8n workflows
backed by Ollama.

## Quick start

**Prerequisites:** Node.js and access to the Supabase/n8n environment values.

```bash
npm ci
# Option A — test Supabase (heyklever):
npm run env:test
# Option B — blank template:
cp .env.example .env.local
npm run dev
```

`npm run env:test` writes `.env.local` from `.env.test` (self-hosted test
Supabase at `https://supabase.heyklever.app`). For a fully local Docker stack,
run `npm run supabase:start` and paste keys from `npm run supabase:status`.

Fill `.env.local` from `.env.example` before starting the dev server if you are
not using `env:test`. The minimum local app setup needs Supabase URL/keys;
cron, SMTP, and n8n webhook values are only needed for the workflows that call
those services.

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the local Next.js dev server |
| `npm run lint` | Run ESLint over the repo |
| `npm run build` | Build the Next.js app |
| `npm run test:unit` | Run focused TypeScript unit tests |
| `npm run test:e2e` | Run Playwright smoke tests (loads `.env.test`) |
| `npm run env:test` | Write `.env.local` from `.env.test` (heyklever Supabase) |
| `npm run supabase:start` | Start local Supabase via Docker CLI |
| `npm run supabase:status` | Print local Supabase URL/keys |
## Architecture at a glance

```text
Browser / Next.js App Router
  -> Supabase Auth + Postgres (issue stances, polls, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system poll drafts, cron)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Public sak detail pages under `/dashboard/sak/[id]`, politician pages,
  `/dashboard/utforsk`, `/dashboard/avstemninger`, and `/dashboard/folkets-meninger`
  can be viewed without authentication; the rest of
  `/dashboard/*` requires a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak pages collect personal issue stances through `/api/stance`: `enig`,
  `uenig`, or `ikke_interessert`. These are private to the user and feed
  Valgomat readiness, profile history, and hjertesak suggestions.
- Historical anonymous For/Mot/Avstår vote totals remain readable through
  `GET /api/vote` for "Folkets vilje vs. Stortinget". `POST /api/vote` returns
  `410`; new per-sak interaction must use `/api/stance`. System Reels and other
  advisory polls use Ja/Nei/Blank.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Public UGC such as høring comments, Folkets meninger, motforslag, and
  Diskusjon posts requires a public first and last name via
  `user_has_public_identity`.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, issue stances, legacy vote totals, sak cache, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, document embedding, app cron, and system-poll draft workflows; archived forum workflow notes |
| [`infra/searxng/README.md`](infra/searxng/README.md) | Legacy SearXNG configuration for archived forum research workflows |
| [`docs/fider-oauth.md`](docs/fider-oauth.md) | Fider feature requests at `https://feedback.folkets-meninger.no` and OAuth SSO setup |
| [`scripts/archive/deploy-forum-prompts-n8n.md`](scripts/archive/deploy-forum-prompts-n8n.md) | Archived forum prompt workflow deployment notes |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/backfill-ai-summaries-v2.mjs` | Refresh AI summary source context and trigger summary backfills |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/reclaim-document-storage.sql` | Clear legacy document bodies when Supabase storage approaches quota |
| `scripts/archive/archive-misaligned-forum-prompts.sql` | Archived forum cleanup helper for old prompt rows |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
