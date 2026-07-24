# n8n – AI-sammendrag backfill (Ollama)

Workflow-kilde: [`ai-summary-backfill.workflow.ts`](ai-summary-backfill.workflow.ts)

**Live workflow:** https://n8n.heyklever.app/workflow/GP666Zq84qc19tcE

## Flyt

1. Hent `stortinget_issues` uten rad i `issue_ai_summaries` (schedule) eller via webhook + `id`
2. Bygg kontekst fra `title`, `summary`, `detail_json` (Code)
3. **AI Agent** med **Ollama Chat Model** → strukturert JSON (`hva`, `hvem`, `kostnad`)
4. Upsert til `issue_ai_summaries` (ingen speiling til `stortinget_issues`)

Appen genererer ikke sammendrag selv — den leser Supabase og poller `GET /api/sak/[id]/ai-summary` til rad finnes.

## Konfigurasjon i n8n

| Nøkkel | Hvor | Verdi |
|--------|------|--------|
| **Ollama credential** | «Ollama Heyklever» | Base URL: `https://ollama.heyklever.app` |
| **Modell** | Under «Ollama Chat Model» | f.eks. `llama3.2:3b-text-q4_K_M` |
| **batchLimit** | «Backfill settings (schedule)» | `1` (anbefalt) |
| **Postgres** | «Supabase Postgres Folkets» | Supabase connection string |

n8n blokkerer `$env` i noder — ikke bruk `$env` for app-URL her.

## Webhook fra appen

```bash
N8N_AI_SUMMARY_WEBHOOK_URL=https://n8n.heyklever.app/webhook/folkets-ai-summary
```

`lib/trigger-ai-summary-webhook.ts` kalles når sak synkes uten sammendrag, og fra `GET /api/sak/[id]/ai-summary` mens rad mangler.

## Triggere

| Trigger | Oppførsel |
|---------|-----------|
| **Every 10 minutes** | SQL → én sak → Ollama agent → lagre → 5 s pause |
| **Webhook POST** | `{ "stortinget_issue_id": "…" }` → hent sak → Ollama → lagre → JSON-svar |

## Test webhook

```bash
curl -X POST "$N8N_AI_SUMMARY_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"stortinget_issue_id":"200329"}'
```

## Supabase-skjema

Etter migrasjon `20260529120000_simplify_issue_ai_summaries.sql`:

| Beholdes | Fjernet |
|----------|---------|
| `issue_ai_summaries`: `stortinget_issue_id`, `hva`, `hvem`, `kostnad`, `created_at`, `updated_at` | `context_hash`, `approved_at`, `hva_approved_at`, `hvem_approved_at`, `kostnad_approved_at`, `cards_json`, `cards_approved_at` |
| — | `stortinget_issues.ai_summary_json`, `ai_summary_generated_at` |

Kjør `supabase db push` etter pull.

## Forum Reels (v12 – Regjeringen RSS + prompt generator)

| Steg | Kilde | Webhook |
|------|--------|---------|
| **1 Regjeringen RSS** | [`forum-regjeringen-rss-ingest.workflow.ts`](forum-regjeringen-rss-ingest.workflow.ts) | RSS Feed Trigger + cron `*/30` (RSS Read) |
| **2 Prompt generator** | [`forum-prompt-generator.workflow.ts`](forum-prompt-generator.workflow.ts) | schedule + `POST /webhook/folkets-forum-prompt-generator` |

**Dok:** [`FORUM-PROMPTS-v12.md`](FORUM-PROMPTS-v12.md)

**Live:** RSS `6yy1ESY2Zy7cWgtF` · Prompt generator `vOP2zPflfT0yBvDQ`

**Env:** `N8N_FORUM_SYNTHESIS_WEBHOOK_URL` → `https://n8n.heyklever.app/webhook/folkets-forum-prompt-generator`

**Deploy:**

```bash
node scripts/bundle-forum-regjeringen-rss-workflow.mjs /tmp/regjeringen-rss.ts
node scripts/bundle-forum-prompt-generator-workflow.mjs /tmp/prompt-generator.ts
npm run deploy:forum-v12 -- --publish
```

Arkivér v10/v11 scout/journalist/editor etter deploy (allerede arkivert — se FORUM-PROMPTS-v12.md).

## Forum Reels v13 – Stortinget-sak RAG

| Steg | Kilde | Webhook |
|------|--------|---------|
| **Sak-RAG prompt generator** | [`forum-sak-prompt-generator.workflow.ts`](forum-sak-prompt-generator.workflow.ts) | cron daglig 06:00 + `POST /webhook/folkets-forum-sak-prompt-generator` |

**Dok:** [`FORUM-PROMPTS-v13.md`](FORUM-PROMPTS-v13.md)

**Env:** `N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL`

**Deploy:**

```bash
node scripts/bundle-forum-sak-prompt-generator-workflow.mjs /tmp/sak-prompt-generator.ts
npm run deploy:forum-v13-sak-prompt -- --temp-id <id> --publish
```

**App:** Admin pipeline viser sak-kandidater; sak-side har «Generer reel-utkast» for forum-admin.

**Opprydding feilaktige aktive prompts:** [`scripts/archive-misaligned-forum-prompts.sql`](../../scripts/archive-misaligned-forum-prompts.sql)

## Forum trending prompts (v5 – SearXNG + RSS, alltid draft)

Workflow-kilde: [`forum-trending-prompts.workflow.ts`](forum-trending-prompts.workflow.ts)

**Live workflow:** https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv

**v5:** alignment-gate, dedupe 0.55, min 4 kilder, **alltid `draft`** → admin-godkjenning i appen (`/dashboard/admin/forum-prompts`).

**App:** `FORUM_REELS_PUBLIC=false` (default) skjuler aktive reels for vanlige brukere; forum-admin ser forhåndsvisning. Sett `FORUM_REELS_PUBLIC=true` ved lansering.

Deploy:

```bash
node scripts/build-n8n-forum-prompts-ops.mjs /tmp/n8n-forum-prompts-ops.json
node scripts/build-n8n-forum-prompts-topology-ops.mjs /tmp/n8n-forum-prompts-topology-ops.json
```

| Nøkkel | Backfill settings |
|--------|-------------------|
| `batchLimit` | `10` (maks 8 per kjøring) |
| `searxngBaseUrl` | f.eks. `https://searxng.heyklever.app` |
| `longRunningMinDays` | `14` |

Webhook: `POST /webhook/folkets-forum-prompts` (env `N8N_FORUM_PROMPTS_WEBHOOK_URL`).

## Dokument ingestion + RAG embeddings

**Live workflow:** https://n8n.heyklever.app/workflow/IkedEmJEJFqj7ZnM

App-side kilde:

- `lib/stortinget-detail-cache.ts` kaller `ingestSakDocuments` ved cache-hit og
  cache-refresh.
- `lib/stortinget-document-ingest.ts` parser saksdokumenter, henter visbar HTML
  fra Stortinget, lagrer tekst/HTML i `stortinget_issue_documents`, og oppretter
  `document_chunks` med `embedding_status='pending'`.
- `lib/trigger-document-embeddings-webhook.ts` sender fire-and-forget webhook når
  nye chunks er opprettet.

| Nøkkel | Verdi |
|--------|--------|
| `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` | f.eks. `https://n8n.heyklever.app/webhook/folkets-document-embeddings` |

Webhook (valgfri sak-id):

```bash
curl -X POST "$N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"stortinget_issue_id":"200329"}'
```

Supabase-migrasjon: `20260617120000_sak_documents_rag.sql` (`content_html`, `document_chunks`, pgvector).

AI-sammendrag (`ai-summary-backfill`) inkluderer nå `rag_chunks` i kontekst når dokumenter er ingestet.

Backfill / deploy:

```bash
npx tsx scripts/backfill-sak-documents.ts 10
node scripts/deploy-document-embeddings-n8n.mjs
```

Feilsøking:

| Symptom | Sjekk |
|---------|-------|
| Ingen dokumenter | Saken mangler visbare dokumentreferanser, eller `parseSakDocuments` fant ingen |
| Chunks blir stående `pending` | `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL`, n8n workflow-status, og Ollama embedding-modell |
| AI-sammendrag mangler dokumentkontekst | Kjør dokumentbackfill først, deretter AI summary backfill/webhook |

## App cron (erstatter Vercel Cron)

Workflow-kilde: [`app-cron.workflow.ts`](app-cron.workflow.ts)

Vercel **Hobby** har ikke Cron Jobs (krever Pro). n8n scheduler kaller appens beskyttede endepunkter med header `x-cron-secret`.

| n8n schedule | App-endepunkt |
|--------------|---------------|
| Daglig 03:00 | `GET /api/cron/sync-issues` |
| Daglig 04:00 | `GET /api/cron/categories` |
| Daglig 04:30 | `GET /api/cron/labels` |
| Daglig 07:00 | `GET /api/cron/digest?frequency=daily` |
| Mandag 07:30 | `GET /api/cron/digest?frequency=weekly` |

`sync-issues` returnerer bl.a. `upserted`, `total`, `newIssueIds`,
`aiSummaryTriggered` og `detailsRefreshed`. `detailsRefreshed` er antall stale
pending saker som fikk detaljcache oppdatert i samme kjøring.

**Cron settings** (Set node — fyll inn i n8n, ikke commit secret):

| Felt | Verdi |
|------|--------|
| `appBaseUrl` | Prod-URL: `https://www.folkets-stemme.no` |
| `cronSecret` | Samme som `CRON_SECRET` i Vercel env (alle fire Cron settings-noder) |

**Live workflow:** https://n8n.heyklever.app/workflow/rwiy05sitrv5QDbQ

Manuell test:

```bash
curl -sS -H "x-cron-secret: $CRON_SECRET" \
  "https://www.folkets-stemme.no/api/cron/sync-issues"
```

## Deploy fra repo

Valider og opprett via n8n-mcp: `validate_workflow` → `create_workflow_from_code` → `publish_workflow`.
