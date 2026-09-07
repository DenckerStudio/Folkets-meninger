# Folkets Stemme

Folkets Stemme is a Next.js App Router application for following Stortinget
saker and høringer, voting on active saker, taking part in advisory
Avstemninger/borgerinitiativ, and discussing individual saker. The app reads
public Stortinget data from `data.stortinget.no`, stores app state in Supabase,
and delegates AI summaries, document embeddings, cron jobs, motforslag
packaging, and system poll (Reels) draft generation to n8n workflows backed by
Ollama.

## Quick start

**Prerequisites:** Node.js and access to the Supabase/n8n environment values.

```bash
npm install
# Option A — test Supabase (Folkets-Stemme test project):
npm run env:test
# Option B — blank template:
cp .env.example .env.local
npm run dev
```

`npm run env:test` writes `.env.local` from `.env.test` (hosted test Supabase).
For a fully local Docker stack, run `npm run supabase:start` and paste keys from
`npm run supabase:status`.

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
  -> Supabase Auth + Postgres (votes, polls, discussions, notifications, sak cache)
  -> data.stortinget.no (saker, details, høringer, publications)
  -> n8n webhooks (AI summaries, document embeddings, system poll drafts, cron)
  -> Ollama / SMTP as workflow dependencies
```

Important constraints:

- Public sak detail pages under `/dashboard/sak/[id]`, politician pages,
  `/dashboard/avstemninger`, and `/dashboard/initiativ` can be viewed without
  authentication; the rest of `/dashboard/*` requires a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak votes are For/Mot/Avstår. National polls under Avstemninger use Ja/Nei/Blank.
- Votes are accepted only while a sak is open. The app and `cast_vote` RPC both
  check `status`, `ferdigbehandlet`, and `voting_closes_at`.
- Høringer are fetched live from Stortinget, not cached in Postgres. Local
  "innspill" are public app comments and are not sent to Stortinget.
- Sak discussion lives on each sak detail page under the `#diskusjon` tab. It
  uses `issue_discussions` / `issue_discussion_posts`, requires login plus public
  first and last name to post, and is not the removed site-wide forum.
- Public activity is opt-in with `users.activity_visibility`; vote choices stay
  private.
- Admin access uses DB RBAC (`user_roles` + `is_admin()`). Current admin pages
  are `/dashboard/admin`, `/dashboard/admin/statistikk`, and
  `/dashboard/admin/reels`.
- Stemme+ is a supporter tier stored on `users.subscription_tier`. Stripe
  checkout is deferred; grant test access through `/api/admin/stemme-plus`, the
  admin Reels UI, or the `grant_stemme_plus_by_email` RPC.
- Dashboard navigation is flat: header primary items are Utforsk,
  Avstemninger, Høringer, and Forslag. Dashboard routes use the sidebar/mobile
  drawer as the single extended navigation surface.
- Sak treatment labels are resolved from multiple Stortinget sources because
  list exports can keep `status=1` after a detail payload says the sak is
  `ferdigbehandlet`.
- AI summary text is not generated in the Next.js app. The app stores source
  context and triggers n8n; summaries are read back from Supabase.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, voting/poll RPCs, sak cache, hearing comments, sak discussion, notifications, Stemme+, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, system poll draft, document embedding, app cron, and motforslag workflows |
| [`docs/fider-oauth.md`](docs/fider-oauth.md) | Fider feature requests at `https://feedback.folkets-meninger.no` and OAuth SSO setup |
| [`docs/DESIGN-sak-discussion.md`](docs/DESIGN-sak-discussion.md) | Design notes for the sak-scoped Diskusjon MVP |
| [`infra/coolify/README.md`](infra/coolify/README.md) | Coolify, egress, Fider, and forum-removal history/runbook |
| [`infra/searxng/README.md`](infra/searxng/README.md) | Legacy SearXNG notes for archived forum prompt workflows |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
