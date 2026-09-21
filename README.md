# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, sharing public opinions, and collecting personal issue
stances. The app reads public Stortinget data from `data.stortinget.no`, stores
app state in Supabase, and delegates AI summaries, system Reels drafts, document
embeddings, and cron jobs to n8n workflows backed by Ollama.

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
  -> Supabase Auth + Postgres (stances, polls, opinions, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system Reels, cron)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Primary navigation is `Folkets meninger`, `Utforsk`, `Høringer`, and
  `Forslag`. `/dashboard` lands on `/dashboard/folkets-meninger` in the current
  app surface.
- Public read routes include sak details under `/dashboard/sak/[id]`,
  politician pages, `/dashboard/utforsk`, `/dashboard/avstemninger` (and
  individual polls), and `/dashboard/folkets-meninger` (and individual
  opinions). Writing or saving personal data requires a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak pages no longer cast public For/Mot/Avstår ballots. Users can save a
  personal issue stance (`enig`, `uenig`, or `ikke_interessert`) through
  `/api/stance`; these signals feed Valgomat and profile "hjertesaker".
- Legacy `/api/vote` still exposes historical aggregate totals for alignment
  displays, but `POST /api/vote` returns 410 and points users to `/api/stance`.
- System Reels on Utforsk and other polls under `/dashboard/avstemninger` use
  Ja/Nei/Blank ballots. Poll voting requires login; public read access does not.
- Folkets meninger is a public opinion surface. Creating an opinion requires a
  public first/last name, a For/Imot stance, at least 250 characters, and at
  least three For/Imot bullet points. Replies can be For, Imot, or Blank.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Legacy `/forum`, `/initiativ`, and `/dashboard/avstemninger/reels` URLs
  redirect to the current Folkets meninger or Utforsk surfaces.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, issue stances, polls, Folkets meninger, sak cache, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, document embedding, system Reels draft, motforslag packaging, and app cron workflows |
| [`infra/searxng/README.md`](infra/searxng/README.md) | Archived SearXNG deployment/configuration notes from the removed forum pipeline |
| [`docs/fider-oauth.md`](docs/fider-oauth.md) | Fider feature requests at `https://feedback.folkets-meninger.no` and OAuth SSO setup |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/reclaim-document-storage.sql` | Reclaim legacy cached document bodies if Supabase storage quota is tight |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts`, `lib/stortinget-horinger.test.ts`,
`lib/sak-participation.test.ts`, `lib/polls/format.test.ts`, and related
domain tests; they run through `npm run test:unit`.
