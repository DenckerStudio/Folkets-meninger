# Folkets Meninger

Folkets Meninger is a Next.js App Router application for following Stortinget
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
  `/dashboard/utforsk`, `/dashboard/avstemninger`, and `/dashboard/folkets-meninger`
  can be viewed without authentication; the rest of
  `/dashboard/*` requires a Supabase session.
- Høringer live under `/dashboard/horinger` and `/dashboard/horinger/[id]`.
  `/horinger` redirects there, so browsing and local comments require login.
- Sak votes are For/Mot/Avstår. System Reels on Utforsk use Ja/Nei/Blank.
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
- Stemme+ (59 kr/mnd) gates BYOK AI-chat from a glowing orb overlay on dashboard
  chrome (not a sidebar page). `/dashboard/chat` only deep-links the overlay.
  Users store an encrypted LLM key; tools retrieve sak chunks (no embeddings
  column) and search `https://searxng.heyklever.app`. Stripe checkout is real
  when keys exist, otherwise the UI says it is not configured. Admin can still
  grant Stemme+ via `/dashboard/admin/stemme-plus`.

## Documentation index

| File | Covers |
|------|--------|
| [`AGENTS.md`](AGENTS.md) | Agent-facing architecture facts, env vars, validation expectations, and operational notes |
| [`supabase/README.md`](supabase/README.md) | Migration domains, voting RPCs, sak cache, hearing comments, forum schema, notifications, RAG tables, and DB runbooks |
| [`workflows/n8n/README.md`](workflows/n8n/README.md) | AI summary, forum prompt, document embedding, and app cron workflows |
| [`infra/searxng/README.md`](infra/searxng/README.md) | SearXNG used by Stemme+ chat source search (and archived forum workflows) |
| [`scripts/deploy-forum-prompts-n8n.md`](scripts/deploy-forum-prompts-n8n.md) | Forum prompt workflow deployment notes |

## Operational scripts

| Script | Use |
|--------|-----|
| `scripts/backfill-sak-status.ts` | Refresh `ferdigbehandlet`, `voting_closes_at`, and sak metadata from Stortinget detail data |
| `scripts/backfill-sak-documents.ts` | Ingest recent sak documents and create pending RAG chunks |
| `scripts/backfill-embedding-v2.ts` | Coolify one-off: fyll `embedding_v2` (bge-m3) med to baner og busy-pause mot chat-embed |
| `scripts/deploy-document-embeddings-n8n.mjs` | Deploy/update the document embeddings workflow in n8n |
| `scripts/archive-misaligned-forum-prompts.sql` | Archive active forum prompts that should no longer be shown |

Example status refresh:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

### embedding_v2 backfill (Coolify one-off)

Krever migrasjon `20261026110000` + `20261026110100` (etter RAG fase B). Sett
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` og `EMBED_BACKFILL_URL` (Ollama
`/api/embed`, typisk samme CPU-instans som `EMBED_QUERY_URL` på `:11435`).
Målt throughput på klever er ~**55 chunks/min** med `--batch 16` og én worker
(CPU mettet). Grovestimat for ~380k pending: **380 000 / 55 ≈ 6 900 min ≈ 5 døgn**
ved full fart døgnet rundt.

```bash
# Tørrkjør
EMBED_BACKFILL_URL=http://192.168.50.154:11435 \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/backfill-embedding-v2.ts --dry-run

# Produksjon (busy-pause på automatisk når URL deler chat-instansen)
EMBED_BACKFILL_URL=http://192.168.50.154:11435 \
EMBED_QUERY_URL=http://192.168.50.154:11435 \
npx tsx scripts/backfill-embedding-v2.ts \
  --workers 1 --batch 16 \
  --schedule '22-07:full,07-22:throttle' \
  --max-batches-per-min 3 \
  --stop-file /data/backfill-v2.stop
```

`:11434` (GPU / gemma) avvises med mindre `--allow-gpu`. Valgfritt:
`--busy-pause=off`, `--probe-before-batch`, `--summary-on-sak-complete`.

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
