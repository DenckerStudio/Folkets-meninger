# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, voting on active saker, and discussing political issues in a
moderated forum. The app reads public Stortinget data from
`data.stortinget.no`, stores app state in Supabase, and delegates AI summaries,
forum prompt generation, and document embeddings to n8n workflows backed by
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
  -> Supabase Auth + Postgres (votes, forum, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, forum prompts, cron)
  -> Ollama / SearXNG / SMTP as workflow dependencies
```

Important constraints:

- Public sak detail pages under `/dashboard/sak/[id]`, politician pages,
  `/dashboard/avstemninger`, and `/dashboard/initiativ` can be viewed without
  authentication; the rest of `/dashboard/*` requires a Supabase session.
- `/innspill` is public and posts product feedback to `POST /api/feedback`.
  The route stores submissions with the service role and sends a best-effort
  SMTP notification.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak votes are For/Mot/Avstår. National polls under Avstemninger use Ja/Nei/Blank.
- Votes are accepted only while a sak is open. The app and `cast_vote` RPC both
  check `status`, `ferdigbehandlet`, and `voting_closes_at`.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- Human forum posts require a public first and last name. System forum threads
  created by workflows use the `is_system_thread` path instead.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, voting RPCs, sak cache, hearing comments, forum schema, marketing feedback, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, forum prompt, document embedding, and app cron workflows |
| [`infra/searxng/README.md`](infra/searxng/README.md) | SearXNG deployment/configuration used by forum prompt discovery |
| [`scripts/deploy-forum-prompts-n8n.md`](scripts/deploy-forum-prompts-n8n.md) | Forum prompt workflow deployment notes |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/archive-misaligned-forum-prompts.sql` | Archive active forum prompts that should no longer be shown |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.

## Public feedback flow

`/innspill` is the public "Gi innspill" page linked from the landing footer. It
uses `components/innspill-form.tsx` to submit to `POST /api/feedback` with:

- `email` (required, validated), `message` (required, minimum 10 characters)
- `name` (optional), `category` (`idé`, `feil`, `spørsmål`, or `annet`)
- `page_path` (defaults to `/innspill`) and a hidden `company` honeypot

The route is intentionally unauthenticated. It rate-limits by client IP in
middleware (`8/minute` for `/api/feedback`) and again in the route
(`5/minute`), ignores honeypot submissions, and truncates accepted field lengths
before writing. `SUPABASE_SERVICE_ROLE_KEY` is required for persistence to
`site_feedback` and must be present before the route attempts delivery. SMTP is
best-effort via the existing `SMTP_*` vars and optionally
`FEEDBACK_INBOX_EMAIL` (falls back to `kontakt@folketsstemme.no`). Once the
service role key is configured, the API returns `{ ok: true }` if either
persistence or email succeeds.
