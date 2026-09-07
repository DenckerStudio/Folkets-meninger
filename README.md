# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, voting on active saker, answering Ja/Nei/Blank polls, and
creating citizen initiatives. The app reads public Stortinget data from
`data.stortinget.no`, stores app state in Supabase, and delegates AI summaries,
document embeddings, system poll drafts (Reels), and cron packaging work to n8n
workflows backed by Ollama.

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
  -> Supabase Auth + Postgres (votes, polls, initiatives, notifications, RAG)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system polls, cron)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Public sak detail pages under `/dashboard/sak/[id]`, politician pages,
  `/dashboard/avstemninger` (including Reels/detail pages), and
  `/dashboard/initiativ` can be viewed without authentication. Voting,
  endorsements, høringer, admin, profile, and the rest of `/dashboard/*` require
  a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, and `/api/kalender/horinger.ics` publishes a
  90-day past/future iCalendar feed from the same Stortinget source.
- Sak votes are For/Mot/Avstår. National polls under Avstemninger use Ja/Nei/Blank.
- Votes are accepted only while a sak is open. The app and `cast_vote` RPC both
  check `status`, `ferdigbehandlet`, and `voting_closes_at`.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Forum surfaces and forum n8n pipelines are removed. System-generated Reels are
  draft `polls` rows (`track=system`) created by n8n and published by admins.
- Public first and last name are required before creating local hearing comments,
  citizen initiatives, or motforslag. Activity visibility is opt-in
  (`private` by default).
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.
- Sak pages include the source-grounded impact calculator (`POST
  /api/sak/[id]/impact`), folk-vs-Stortinget alignment, knowledge quiz/document
  read awards, and motforslag packaging through
  `GET /api/cron/package-counter-proposals`.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, voting/poll RPCs, sak cache, identity/admin, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, document embedding, system poll draft, motforslag packaging, and app cron workflows |
| [`infra/coolify/README.md`](infra/coolify/README.md) | Forum-removal/egress plan history and Coolify deployment notes |
| [`workflows/n8n/archive/forum/`](workflows/n8n/archive/forum/) | Historical forum pipeline docs only; not active product workflows |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/use-test-env.mjs` | Recreate `.env.local` from `.env.test` for local build/dev runs |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile paths lives under `lib/*.test.ts`
(sak status, høringer/calendar ICS, polls, impact/alignment, knowledge, and
motforslag packaging); all run through `npm run test:unit`.
