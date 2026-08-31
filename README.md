# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, voting on active saker, participating in Ja/Nei/Blank
avstemninger, and creating borgerinitiativ. The app reads public Stortinget data
from `data.stortinget.no`, stores app state in Supabase, and delegates AI
summaries, document embeddings, system poll drafts, and cron orchestration to
n8n workflows backed by Ollama.

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
  -> Supabase Auth + Postgres (votes, polls, initiatives, hearings, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system poll drafts, cron, motforslag)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Public sak detail pages under `/dashboard/sak/[id]`, politician pages,
  `/dashboard/avstemninger`, and `/dashboard/initiativ` can be viewed without
  authentication; the rest of `/dashboard/*` requires a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- `/dashboard/kalender` shows høring sessions and deadlines for logged-in users.
  `/api/kalender/horinger.ics` exposes the same hearing window as an iCalendar
  feed with one-hour cache headers.
- Sak votes are For/Mot/Avstår. National polls under Avstemninger use Ja/Nei/Blank.
- Votes are accepted only while a sak is open. The app and `cast_vote` RPC both
  check `status`, `ferdigbehandlet`, and `voting_closes_at`.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Public first and last name are required before publishing høring comments or
  creating borgerinitiativ. BankID/MinID verification is not shipped yet.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Forum has been removed from the product. Historical forum/n8n files remain
  archived only; do not add new `forum_*` UI, env vars, or workflows.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, voting/poll RPCs, sak cache, public identity, hearing comments, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, document embedding, system poll draft, app cron, and motforslag workflows |
| [`infra/coolify/README.md`](infra/coolify/README.md) | Coolify deployment notes and the forum-removal/egress-reduction plan |
| [`workflows/n8n/archive/forum/`](workflows/n8n/archive/forum/) | Historical forum prompt workflow notes (inactive) |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/reclaim-document-storage.sql` | Clear legacy cached document bodies after chunks are stored |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
