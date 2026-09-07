# n8n – Folkets Stemme

Aktive workflows bruker to Supabase-tilkoblinger:

- **Folkets Stemme Self-hosted** (`supabaseApi`) for PostgREST RPC-kall i
  dokument-embeddings og system poll drafts.
- **Supabase Postgres Folkets** for AI-sammendrag-backfill, som fortsatt kjører
  trimmede SQL-spørringer og upsert-SQL via Postgres-noden.

Etter `20260823200000_n8n_postgrest_rpcs.sql` (`supabase db push`) skal
PostgREST-baserte n8n-steg skrive via SECURITY DEFINER-RPC-er. Direkte
tabell-INSERT via Supabase API treffer RLS (42501) på self-hosted PostgREST.

| Workflow | Status | Live |
|----------|--------|------|
| AI-sammendrag backfill | Aktiv | https://n8n.heyklever.app/workflow/GP666Zq84qc19tcE |
| Dokument embeddings (RAG) | Aktiv | https://n8n.heyklever.app/workflow/IkedEmJEJFqj7ZnM |
| App cron | Aktiv | https://n8n.heyklever.app/workflow/rwiy05sitrv5QDbQ |
| Motforslag horingsinnspill | Aktiv | https://n8n.heyklever.app/workflow/VX3uRDi7cVRwpxuQ |
| System poll (Reels) draft | Aktiv | https://n8n.heyklever.app/workflow/TWTrqNYhvYcWz4UX |
| Forum (v9/v12/v13/RSS) | Arkivert | `archive/forum/` |

## AI-sammendrag backfill (Ollama)

Workflow-kilde: [`ai-summary-backfill.workflow.ts`](ai-summary-backfill.workflow.ts)

**Live workflow:** https://n8n.heyklever.app/workflow/GP666Zq84qc19tcE

## Flyt

1. Hent `stortinget_issues` uten rad i `issue_ai_summaries` (schedule) eller via
   webhook + `id` med Postgres-noden.
2. Bygg kontekst fra `title`, `summary`, trimmede `detail_json`-felt,
   `ai_summary_source_context`, dokumentutdrag og ready `document_chunks`.
3. **AI Agent** med **Ollama Chat Model** → strukturert v2-JSON
   (`narrative`, `who_affected`, `how_affected`, `topic_cards`, `labels`) pluss
   legacy-feltene `hva`, `hvem`, `kostnad`.
4. Upsert til `issue_ai_summaries` og synk `stortinget_issues.ai_labels`.

Appen genererer ikke sammendrag selv — den leser Supabase og poller `GET /api/sak/[id]/ai-summary` til rad finnes.

Etter `20260823210000_n8n_ai_summary_rich_context.sql` henter n8n `ai_summary_source_context`, dokumentutdrag og `document_chunks` (ikke full `detail_json`). Prompten ber om 5–8 setninger. Ollama: `numPredict` 2200, `numCtx` 16384, `think: false`. Dokumentingest bygger kilden på nytt og kjører webhooken om igjen så tynne sammendrag overskrives.

## Konfigurasjon i n8n

| Nøkkel | Hvor | Verdi |
|--------|------|--------|
| **Ollama credential** | «Ollama Heyklever» | Base URL: `https://ollama.heyklever.app` |
| **Modell** | Under «Ollama Chat Model» | f.eks. `llama3.2:3b-text-q4_K_M` |
| **batchLimit** | «Backfill settings (schedule)» | `1` (anbefalt) |
| **Supabase API** | «Folkets Stemme Self-hosted» (supabaseApi) | Supabase URL + service role via n8n Supabase node; brukes av RPC-workflows |
| **Supabase Postgres** | «Supabase Postgres Folkets» | Brukes av AI-sammendrag-backfill |

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

Etter migrasjonene `20260529120000_simplify_issue_ai_summaries.sql`,
`20260608120000_issue_ai_summaries_v2.sql` og
`20260823210000_n8n_ai_summary_rich_context.sql`:

| Beholdes | Fjernet |
|----------|---------|
| `issue_ai_summaries`: `stortinget_issue_id`, `hva`, `hvem`, `kostnad`, `narrative`, `who_affected`, `how_affected`, `topic_cards`, `labels`, `created_at`, `updated_at` | `context_hash`, `approved_at`, `hva_approved_at`, `hvem_approved_at`, `kostnad_approved_at`, `cards_json`, `cards_approved_at` |
| — | `stortinget_issues.ai_summary_json`, `ai_summary_generated_at` |

`n8n_get_issue_ai_summary_context(text)` exposes trimmed detail fields,
`ai_summary_source_context`, dokumentutdrag og chunk-tekst for n8n. Appen
returnerer v2 når den finnes, og faller tilbake til legacy
`hva`/`hvem`/`kostnad` via `GET /api/sak/[id]/ai-summary`.

Kjør `supabase db push` etter pull.

## System poll drafts (Reels)

Workflow-kilde: [`system-poll-draft.workflow.ts`](system-poll-draft.workflow.ts) · [`system-poll-draft.shared.ts`](system-poll-draft.shared.ts)

Lager **utkast** (`polls.track = 'system'`, `status = 'draft'`) fra stortingssak + RAG.
Admin publiserer i `/dashboard/admin/reels`. Offentlig feed: `/dashboard/avstemninger/reels`.

**Live workflow:** https://n8n.heyklever.app/workflow/TWTrqNYhvYcWz4UX

Timezone: `Europe/Oslo`. Credential: **Folkets Stemme Self-hosted**. Ollama: **Ollama account** (`gemma4:e2b-it-qat`).

Daglig 06:00 plukker neste pending sak med ready RAG-chunks og uten eksisterende poll. Webhook kan sende `{ "stortinget_issue_id": "…" }` for én sak (samme kø-filter). Tom kø = tom kjøring, ikke feil. Krever `20260823200000_n8n_postgrest_rpcs.sql`.

| Steg | Beskrivelse |
|------|-------------|
| Sak-kø | Pending sak med ready RAG-chunks, uten eksisterende draft/open/closed poll |
| RAG | Embed tittel+sammendrag → `match_issue_document_chunks` |
| Agent | Ollama ja/nei-spørsmål (ballot er alltid Ja / Nei / Blank) |
| Lagring | `create_system_poll_draft(...)` — ikke `ensure_stortinget_poll` (den åpner med en gang) |

```bash
N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL=https://n8n.heyklever.app/webhook/folkets-system-poll-draft
```

```bash
curl -X POST "$N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"stortinget_issue_id":"200329"}'
```

Triggere: daglig 06:00 + `POST /webhook/folkets-system-poll-draft`. Appen kaller webhooken fra `lib/trigger-system-poll-draft-webhook.ts` og admin «Generer utkast».

## Forum Reels — archived (product removed)

Forum/reels **forum**-pipelines are **inactive**. Sources and docs live under
[`archive/forum/`](archive/forum/). Disable any remaining live n8n workflows that
touch `forum_*` tables. App env no longer uses `N8N_FORUM_*` / `FORUM_REELS_PUBLIC`.

<details><summary>Historical notes (v12/v13/v5)</summary>

## Forum Reels (v12 – Regjeringen RSS + prompt generator)

| Steg | Kilde | Webhook |
|------|--------|---------|
| **1 Regjeringen RSS** | [`archive/forum/forum-regjeringen-rss-ingest.workflow.ts`](archive/forum/forum-regjeringen-rss-ingest.workflow.ts) | RSS Feed Trigger + cron `*/30` (RSS Read) |
| **2 Prompt generator** | [`archive/forum/forum-prompt-generator.workflow.ts`](archive/forum/forum-prompt-generator.workflow.ts) | schedule + `POST /webhook/folkets-forum-prompt-generator` |

**Historisk dok:** [`archive/forum/FORUM-PROMPTS-v12.md`](archive/forum/FORUM-PROMPTS-v12.md)

**Arkivert i n8n:** RSS `6yy1ESY2Zy7cWgtF` · Prompt generator `vOP2zPflfT0yBvDQ`

**Historisk env:** `N8N_FORUM_SYNTHESIS_WEBHOOK_URL` → `https://n8n.heyklever.app/webhook/folkets-forum-prompt-generator`

**Deploy:**

```bash
node scripts/archive/bundle-forum-regjeringen-rss-workflow.mjs /tmp/regjeringen-rss.ts
node scripts/archive/bundle-forum-prompt-generator-workflow.mjs /tmp/prompt-generator.ts
node scripts/archive/deploy-forum-v12-workflows.mjs --publish
```

Arkivér v10/v11 scout/journalist/editor etter deploy (allerede arkivert — se
[`archive/forum/FORUM-PROMPTS-v12.md`](archive/forum/FORUM-PROMPTS-v12.md)).

## Forum Reels v13 – Stortinget-sak RAG

| Steg | Kilde | Webhook |
|------|--------|---------|
| **Sak-RAG prompt generator** | [`archive/forum/forum-sak-prompt-generator.workflow.ts`](archive/forum/forum-sak-prompt-generator.workflow.ts) | cron daglig 06:00 + `POST /webhook/folkets-forum-sak-prompt-generator` |

**Historisk dok:** [`archive/forum/FORUM-PROMPTS-v13.md`](archive/forum/FORUM-PROMPTS-v13.md)

**Historisk env:** `N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL`

**Deploy:**

```bash
N8N_API_KEY=... node scripts/archive/deploy-forum-v13-sak-prompt-generator.mjs --skip-test
```

Deploy-scriptet eksporterer workflow JSON, gjenbruker Supabase/Ollama-credentials
fra eksisterende workflows, finner eller oppretter workflowen, aktiverer den, og
kan smoke-teste webhooken når `--skip-test` utelates.

**App:** Admin pipeline viser sak-kandidater via `get_sak_prompt_coverage()`; sak-side har «Generer reel-utkast» for forum-admin.

**Opprydding feilaktige aktive prompts:** [`scripts/archive/archive-misaligned-forum-prompts.sql`](../../scripts/archive/archive-misaligned-forum-prompts.sql)

## Forum trending prompts (v5 – SearXNG + RSS, alltid draft)

Workflow-kilde: [`archive/forum/forum-trending-prompts.workflow.ts`](archive/forum/forum-trending-prompts.workflow.ts)

**Tidligere live (fjernet/arkivert):** `MloIdsnX7FozM4dv`

**v5:** alignment-gate, dedupe 0.55, min 4 kilder, **alltid `draft`** → admin-godkjenning i appen (`/dashboard/admin/forum-prompts`).

**Historisk app-env:** `FORUM_REELS_PUBLIC=true` viste aktive reels for alle
brukere. Verdien brukes ikke etter forum-fjerningen.

Deploy:

```bash
node scripts/archive/build-n8n-forum-prompts-ops.mjs /tmp/n8n-forum-prompts-ops.json
node scripts/archive/build-n8n-forum-prompts-topology-ops.mjs /tmp/n8n-forum-prompts-topology-ops.json
```

| Nøkkel | Backfill settings |
|--------|-------------------|
| `batchLimit` | `10` (maks 8 per kjøring) |
| `searxngBaseUrl` | f.eks. `https://searxng.heyklever.app` |
| `longRunningMinDays` | `14` |

Webhook: `POST /webhook/folkets-forum-prompts` (historisk env
`N8N_FORUM_PROMPTS_WEBHOOK_URL`).

</details>

## Dokument ingestion + RAG embeddings

**Live workflow:** https://n8n.heyklever.app/workflow/IkedEmJEJFqj7ZnM

**Lagring:** Appen cacher ikke publikasjons-HTML. Chunk-tekst lagres én gang i
`document_chunks`; n8n skriver embeddings til pgvector (påkrevd for RAG — n8n
er ikke vektorlager). Se migrasjon
`20260807112603_document_chunks_storage_efficiency.sql` og
`scripts/reclaim-document-storage.sql` ved `exceed_db_size_quota`.

App-side kilde:

- `lib/stortinget-detail-cache.ts` kaller `ingestSakDocuments` ved cache-hit og
  cache-refresh.
- `lib/stortinget-document-ingest.ts` parser saksdokumenter, henter visbar HTML
  fra Stortinget, lagrer kort `text_excerpt`, oppretter `document_chunks` med
  `embedding_status='pending'`, og sletter `content_full_text`/`content_html`.
- `lib/trigger-document-embeddings-webhook.ts` sender fire-and-forget webhook når
  nye chunks er opprettet.
- n8n (`document-embeddings.workflow.ts`) embedder pending chunks, setter
  `chunks_status=ready`, og rydder leftover dokumenttekst.

| Nøkkel | Verdi |
|--------|--------|
| `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` | f.eks. `https://n8n.heyklever.app/webhook/folkets-document-embeddings` |

Webhook (valgfri sak-id):

```bash
curl -X POST "$N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"stortinget_issue_id":"200329"}'
```

Supabase-migrasjoner: `20260617120000_sak_documents_rag.sql`,
`20260807112603_document_chunks_storage_efficiency.sql`,
`20260823180000_n8n_supabase_views_and_rpcs.sql` (view `n8n_issues_missing_ai_summary` for AI-backfill).

AI-sammendrag (`ai-summary-backfill`) inkluderer nå `rag_chunks` i kontekst når dokumenter er ingestet. Prompten ber også om konkrete grupper og kronebeløp når kilden har dem — brukes av konsekvens-kalkulatoren på sakssiden (`POST /api/sak/[id]/impact`).

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
| `exceed_db_size_quota` / 402 | Kjør `scripts/reclaim-document-storage.sql` som DB-eier, deretter `VACUUM FULL` |

## App cron (erstatter Vercel Cron)

Workflow-kilde: [`app-cron.workflow.ts`](app-cron.workflow.ts)

Vercel **Hobby** har ikke Cron Jobs (krever Pro). n8n scheduler kaller appens beskyttede endepunkter med header `x-cron-secret`.

| n8n schedule | App-endepunkt |
|--------------|---------------|
| Daglig 03:00 | `GET /api/cron/sync-issues` |
| Daglig 04:00 | `GET /api/cron/categories` |
| Daglig 04:30 | `GET /api/cron/labels` |
| Daglig 06:00 | `GET /api/cron/package-counter-proposals` |
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

**Feilsøking (HTTP 500/503 fra app):**

| Symptom | Årsak | Tiltak |
|---------|-------|--------|
| `503` + `CRON_SECRET is not configured` | `CRON_SECRET` mangler i Vercel env for `folkets-inspill` | Legg til `CRON_SECRET` i Vercel → Project Settings → Environment Variables (Production). Verdien må matche `cronSecret` i alle n8n «Cron settings*»-noder. Redeploy etterpå. |
| `401 Unauthorized` | Header `x-cron-secret` matcher ikke appens `CRON_SECRET` | Synkroniser secret mellom n8n og Vercel. |
| `200` + `skipped: smtp_not_configured` på digest | SMTP-variabler mangler | Sett `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` i Vercel. Digest kjører uten å sende e-post inntil SMTP er på plass. |
| `500 Cron error` på sync etter auth | Supabase/Stortinget-feil i handler | Sjekk Vercel runtime logs for `Cron sync-issues error`. Verifiser `SUPABASE_SERVICE_ROLE_KEY` og at Stortinget-API er oppe. |

Forventet suksess: `{"ok":true,...}` med HTTP `200`.

## Motforslag horingsinnspill

Workflow-kilde: [`hearing-innspill-package.workflow.ts`](hearing-innspill-package.workflow.ts)

Appen kaller `N8N_HEARING_INNSPILL_WEBHOOK_URL` når et motforslag når
støtteterskelen. n8n mottar JSON + Markdown. Dette er **ikke** innsending til
et Stortinget-API — rapporten e-postes/lagres, og offisielt innspill lastes
opp på stortinget.no.

```bash
N8N_HEARING_INNSPILL_WEBHOOK_URL=https://n8n.heyklever.app/webhook/folkets-hearing-innspill

**Live workflow:** https://n8n.heyklever.app/workflow/VX3uRDi7cVRwpxuQ
```

## Deploy fra repo

Valider og opprett via n8n-mcp: `validate_workflow` → `create_workflow_from_code` → `publish_workflow`.
