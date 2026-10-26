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

Krever **#185** RAG fase A+B og **#207** kø/leases (`supabase/migrations/EMBEDDING_V2_QUEUE_APPLY.md`).
Scriptet bruker `n8n_claim_chunks_missing_v2` + `save_embeddings_v2` (300 s lease, `SKIP LOCKED`).

**Preflight (hver endpoint):** 20 faste norske tekster embeddes på backfill-endpoint og på Ollama
`EMBED_QUERY_URL` (typisk `:11435` / bge-m3 F16). Alle par må ha cosine ≥ **0.99** og dim **1024**.
Feil preflight **slår ut kun den endpointen**. `--preflight-only` kjører preflight og avslutter.
Spørringssiden logges via Ollama `/api/show` (modell/kvantisering).

**LM Studio (server):** `gpustack/bge-m3-GGUF`, API-modell `bge-m3`, lagres som
`bge-m3:Q8_0 (gpustack GGUF, lmstudio)` i `embedding_v2_model` (eller API/`--model-tag` /
`EMBED_BACKFILL_MODEL_TAG`). `EMBED_BACKFILL_URL` er **påkrevd** for lmstudio (full proxy-URL —
ingen hardkodet host/port i koden).

**Flere endepunkter:** `EMBED_BACKFILL_ENDPOINTS` (JSON-array) eller gjentatt `--endpoint '…'`.
Én **primary** (`"primary": true`) tar **fast** lane (tier 0) + **background**; ekstra noder (f.eks.
gaming-PC med RTX 3080) kun `"lanes": ["background"]`. API-nøkler **kun** via `"apiKeyEnv":
"NAVN_PÅ_ENV"` (aldri verdien i JSON, logger eller repo).

**Throughput (klever, målt):** ~**480 chunks/min** på server-GPU (`batch` 32, 1 worker) → ~**13 t**
for ~380k pending. Ekstra LM Studio-node reduserer wall-clock når den er oppe (background-lane).

**Delt throttle:** WAL/replikasjonsslot (`n8n_backfill_db_pressure`) pauser **alle** workers.
`--schedule '22-07:full,07-22:throttle'` (standard tidssone `Europe/Oslo`). Busy-latency mot chat
når backfill-URL deler `:11435`.

```bash
# Preflight alle endepunkter
EMBED_QUERY_URL=http://ollama-host.example.invalid:11435 \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
EMBED_BACKFILL_ENDPOINTS='[
  {"name":"server","primary":true,"provider":"lmstudio","url":"https://embed-proxy.example/v1",
   "lanes":["fast","background"],"batch":32,
   "modelTag":"bge-m3:Q8_0 (gpustack GGUF, lmstudio)","apiKeyEnv":"EMBED_LMSTUDIO_SERVER_KEY"},
  {"name":"gaming-pc","provider":"lmstudio","url":"https://pc-tunnel.example/v1",
   "lanes":["background"],"batch":32,"apiKeyEnv":"EMBED_LMSTUDIO_PC_KEY"}
]' \
npx tsx scripts/backfill-embedding-v2.ts --preflight-only

# Kjøring
npx tsx scripts/backfill-embedding-v2.ts \
  --schedule '22-07:full,07-22:throttle' \
  --max-batches-per-min 3 \
  --stop-file /data/backfill-v2.stop
```

**Ollama CPU-fallback:** én endpoint med `"provider":"ollama"` — standard `batch` **16**, 1 worker
(~55 chunks/min). `:11434` (GPU/gemma) avvises uten `--allow-gpu`.

Enkel endpoint uten JSON: `EMBED_BACKFILL_PROVIDER=lmstudio`, `EMBED_BACKFILL_URL=…` (primary).
Valgfritt: `--busy-pause=off`, `--probe-before-batch`, `--lease-seconds 300`, `--provider lmstudio`.

#### Gaming-PC worker (background, LM Studio)

Eksempel-env (kun placeholders): `scripts/backfill-embedding-v2.gaming-pc.env.example`.
API-nøkkel **kun** via `LMSTUDIO_API_KEY` (aldri som `apiKey` i JSON).

1. Kopier env-filen lokalt og fyll inn `SUPABASE_*`, `EMBED_QUERY_URL` (Ollama **:11435** for chat/preflight),
   `EMBED_BACKFILL_URL` (LM Studio på PC-en), `LMSTUDIO_API_KEY`.
2. Preflight (må bestå før claiming):

```bash
set -a && source /path/to/gaming-pc.env && set +a
npx tsx scripts/backfill-embedding-v2.ts --provider lmstudio --preflight-only
```

3. Kjør background-worker med lav concurrency og busy-pause:

```bash
npx tsx scripts/backfill-embedding-v2.ts \
  --provider lmstudio \
  --schedule '22-07:full,07-22:throttle' \
  --max-batches-per-min 2 \
  --full-max-batches-per-min 8 \
  --busy-pause=on \
  --busy-latency-ms 1500 \
  --lease-seconds 300 \
  --stop-file /tmp/backfill-v2-gaming-pc.stop
```

**Stopp trygt:** `touch` stop-filen (coordinator frigir leases), eller `SIGINT`/`SIGTERM` (frigir via
`n8n_release_embedding_v2_claims`). `--dry-run` claimer og frigir uten `save_embeddings_v2`.

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
