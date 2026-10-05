# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, saving personal issue stances, writing public opinions, and
voting in ja/nei/blank polls. The app reads public Stortinget data from
`data.stortinget.no`, stores app state in Supabase, and delegates AI summaries,
system-poll draft generation, and document embeddings to n8n workflows backed by
Ollama.

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
  -> Supabase Auth + Postgres (stances, opinions, polls, notifications, sak cache)
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
- Per-sak For/Mot/Avstår voting is legacy read-only: `POST /api/vote` returns
  `410`, while `GET /api/vote?issueId=...` still serves historical totals.
  Current sak participation saves `enig`/`uenig`/`ikke_interessert` through
  `POST /api/stance`.
- System Reels on Utforsk are AI-generated ja/nei/blank polls. Admins publish
  drafts from `/dashboard/admin/reels`; public voting uses `/dashboard/utforsk`
  and `/dashboard/avstemninger`.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Folkets meninger (`/dashboard/folkets-meninger`) stores public opinions in
  Supabase. Authors need a public first and last name, choose For/Imot, write at
  least 250 characters, and include 3-8 For/Imot bullet points. Composer drafts
  stay in browser `localStorage` under `folkets-meninger:opinion-draft:*`.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.
- Appens fremtid (`/dashboard/appens-fremtid`) uses Supabase-backed suggestions,
  changelog entries, and a shared `app_roadmap_items` roadmap. The landing page
  no longer renders a separate roadmap section.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, stance/opinion/poll RPCs, sak cache, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, document embedding, system-poll draft, pipeline health, and app cron workflows |
| [`infra/searxng/README.md`](infra/searxng/README.md) | Legacy SearXNG deployment/configuration for archived forum research workflows |
| [`scripts/archive/deploy-forum-prompts-n8n.md`](scripts/archive/deploy-forum-prompts-n8n.md) | Archived forum prompt workflow deployment notes |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/backfill-ai-summaries-v2.mjs` | Backfill rich AI-summary source context and trigger missing summaries |
| `scripts/reclaim-document-storage.sql` | Clear legacy full document bodies after chunking to reduce Supabase storage |
| `scripts/archive/archive-misaligned-forum-prompts.sql` | Archived cleanup for retired forum prompts |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
