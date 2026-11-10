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
  column) and search via `SEARXNG_BASE_URL` (LAN SearXNG, se `.env.example`). Stripe checkout is real
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

**Kun Ollama:** embeddings hentes via native `POST …/api/embed` (modell `bge-m3`, **1024** dim til
`document_chunks.embedding_v2`). LM Studio / OpenAI `/v1/embeddings` støttes ikke lenger — gammel
`provider: lmstudio` eller `EMBED_BACKFILL_PROVIDER=lmstudio` avvises med tydelig feilmelding.

**Preflight (hver endpoint, én gang per prosess):** 20 faste norske tekster embeddes på
backfill-URL og på `EMBED_QUERY_URL` (typisk `http://<ollama-host>:11435`). Alle par må ha cosine ≥
**0.99** og dim **1024**. Feil preflight **slår ut kun den endpointen**. `--preflight-only` stopper
etter preflight. Ved lang kjøring kan coordinator kjøre recovery-preflight kun når en endpoint har
feilet; begrenset kjøring (`--dry-run` / `--max-batches`) gjør kun oppstarts-preflight.
`--dry-run` kjører uten `save_embeddings_v2`. Spørringssiden logges via Ollama `/api/show`.

**URL:** `EMBED_BACKFILL_URL` kan være `http://<ollama-host>:11435` eller full
`http://<ollama-host>:11435/api/embed`. Standard `provider` er `ollama`, standard `batch` **16**.

**Flere endepunkter:** `EMBED_BACKFILL_ENDPOINTS` (JSON-array) eller gjentatt `--endpoint '…'`.
Én **primary** (`"primary": true`) tar **fast** lane (tier 0) + **background**; ekstra noder kun
`"lanes": ["background"]`.

**Busy-pause:** når backfill deler `:11435` med `EMBED_QUERY_URL` (chat-spørring), er busy-pause **på**
som standard for å beskytte 800 ms query-embeddings. Overstyr med `--busy-pause=off` om nødvendig.

**Delt throttle:** WAL/replikasjonsslot (`n8n_backfill_db_pressure`) pauser **alle** workers.
`--schedule '22-07:full,07-22:throttle'` (standard tidssone `Europe/Oslo`).

```bash
# Preflight / dry-run (ingen DB-skriving; én claim-batch og avslutt som standard)
EMBED_QUERY_URL=http://<ollama-host>:11435 \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
EMBED_BACKFILL_ENDPOINTS='[
  {"name":"server","primary":true,"provider":"ollama","url":"http://<ollama-host>:11435",
   "lanes":["fast","background"],"batch":16,"modelTag":"bge-m3"}
]' \
npx tsx scripts/backfill-embedding-v2.ts --preflight-only
npx tsx scripts/backfill-embedding-v2.ts --dry-run
# valgfritt: flere dry-run-batcher uten lagring
npx tsx scripts/backfill-embedding-v2.ts --dry-run --max-batches 3

# Kjøring
npx tsx scripts/backfill-embedding-v2.ts \
  --schedule '22-07:full,07-22:throttle' \
  --max-batches-per-min 3 \
  --stop-file /data/backfill-v2.stop
```

Enkel endpoint uten JSON: `EMBED_BACKFILL_URL=http://<ollama-host>:11435` (provider default `ollama`).
Valgfritt: `--busy-pause=off`, `--probe-before-batch`, `--lease-seconds 300`.

#### Sekundær worker (background)

Eksempel-env: `scripts/backfill-embedding-v2.gaming-pc.env.example` (kun placeholders).

```bash
set -a && source /path/to/local-backfill.env && set +a
npx tsx scripts/backfill-embedding-v2.ts --preflight-only
npx tsx scripts/backfill-embedding-v2.ts \
  --schedule '22-07:full,07-22:throttle' \
  --max-batches-per-min 2 \
  --busy-pause=on \
  --lease-seconds 300 \
  --stop-file /tmp/backfill-v2.stop
```

**Stopp trygt:** `touch` stop-filen (coordinator frigir leases), eller `SIGINT`/`SIGTERM` (frigir via
`n8n_release_embedding_v2_claims`). `--dry-run` claimer og frigir uten `save_embeddings_v2`, og
stopper etter **én** batch per worker med mindre `--max-batches` settes. Normal kjøring er ubegrenset
til stoppsignal; `--max-batches N` begrenser antall lagrede (eller dry-run-)batcher per worker.

#### Docker restart policy (ops)

When the backfill runs in a long-lived container, use **`--restart on-failure`** on `docker run` — not
`--restart unless-stopped` and not `always`.

If a **`--stop-file`** path is configured and that file exists, the script exits cleanly with code **0**
after releasing leases (`[backfill-v2] stop-file funnet — avslutter.`). With **`unless-stopped`**, Docker
restarts the container regardless of exit code, which causes an endless “stop-file found, exiting” loop
until you **`docker stop`** the container (observed 2026-10-27). With **`on-failure`**, a clean stop
stays stopped; crashes (non-zero exit) still auto-restart.

**Caveat:** a container that exited **0** under **`on-failure`** does not come back after a host reboot —
start it manually.

**Fix an already-running container** (no recreate required):

```bash
docker update --restart on-failure <BACKFILL_CONTAINER>
```

**Example run:**

```bash
docker run -d --name <BACKFILL_CONTAINER> --restart on-failure \
  --env-file <ENV_FILE> \
  -v /data:/data \
  <IMAGE> \
  npx tsx scripts/backfill-embedding-v2.ts \
    --schedule '22-07:full,07-22:throttle' \
    --stop-file /data/backfill-v2.stop
```

**Stop:** `touch` the path passed to **`--stop-file`** (e.g. `/data/backfill-v2.stop`). Wait for exit **0**.

**Start again:** remove the stop file (`rm` that path), then `docker start <BACKFILL_CONTAINER>` (or
re-run `docker run` with the same flags).

Focused unit coverage for recently fragile source parsers/status logic lives in
`lib/sak-status.test.ts` and `lib/stortinget-horinger.test.ts`; both run through
`npm run test:unit`.
