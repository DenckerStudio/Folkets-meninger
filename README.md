# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, sharing public opinions, saving personal issue stances, and
answering advisory Ja/Nei/Blank polls. The app reads public Stortinget data from
`data.stortinget.no`, stores app state in Supabase, and delegates AI summaries,
system poll draft generation, document embeddings, and cron orchestration to n8n
workflows backed by Ollama.

## Quick start

**Prerequisites:** Node.js and access to the Supabase/n8n environment values.

```bash
npm install
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
  -> Supabase Auth + Postgres (issue stances, polls, opinions, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system poll drafts, cron)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Primary navigation is flat: **Folkets meninger**, **Utforsk**, **Høringer**,
  **Forslag**. Secondary dashboard links (Politikere, Kalender, Innsikt, Min
  side) live in the dashboard sidebar/drawer. Admin users also see **Admin**.
- `/dashboard` redirects to `/dashboard/folkets-meninger`. Public sak detail
  pages under `/dashboard/sak/[id]`, politician pages, `/dashboard/utforsk`,
  `/dashboard/avstemninger`, and `/dashboard/folkets-meninger` can be viewed
  without authentication; the rest of `/dashboard/*` requires a Supabase
  session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak pages save personal issue stances (`enig`, `uenig`, `ikke_interessert`)
  through `/api/stance`. These stances are private inputs for Valgomat and
  hjertesaker, not public ballots.
- Legacy per-sak For/Mot/Avstår voting is read-only. `POST /api/vote` returns
  `410`; `GET /api/vote` still serves historical totals for alignment widgets.
- System Reels live on Utforsk (`/dashboard/utforsk#reels`) as system-generated
  Ja/Nei/Blank polls. Other public polls are under `/dashboard/avstemninger`.
  Legacy citizen/borgerinitiativ rows remain in the database but are hidden in
  the app; `/initiativ` and `/dashboard/initiativ` redirect to Utforsk.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Public UGC (Folkets meninger, sak discussions, høring comments) requires a
  public first and last name via `user_has_public_identity`.
- The site-wide forum has been removed. Forum URLs redirect to Folkets
  meninger, and forum n8n pipelines/scripts are archived only.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, issue stances, legacy voting, polls/Reels, sak cache, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, system poll draft, document embedding, motforslag, and app cron workflows |
| [`infra/coolify/README.md`](infra/coolify/README.md) | Hosted Supabase egress plan and forum-removal history |
| [`infra/searxng/README.md`](infra/searxng/README.md) | Archived SearXNG context for removed forum prompt discovery |
| [`docs/fider-oauth.md`](docs/fider-oauth.md) | Fider feature requests at `https://feedback.folkets-meninger.no` and OAuth SSO setup |
| [`docs/DESIGN-sak-discussion.md`](docs/DESIGN-sak-discussion.md) | Sak-scoped discussion MVP design |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/backfill-ai-summaries-v2.mjs` | Backfill/refresh richer AI summaries through the current n8n workflow |
| `scripts/reclaim-document-storage.sql` | Reclaim cached document bodies after chunking |
| `scripts/archive/*forum*` | Historical forum workflow utilities; archived, not current product automation |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
