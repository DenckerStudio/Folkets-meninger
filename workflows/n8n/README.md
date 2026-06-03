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

## Forum trending prompts

Workflow-kilde: [`forum-trending-prompts.workflow.ts`](forum-trending-prompts.workflow.ts)

**Live workflow:** https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv

**v6 flyt (AI-moderering + læring):** se [`FORUM-PROMPTS-v6.md`](FORUM-PROMPTS-v6.md) — v5 artikkelhenting: [`FORUM-PROMPTS-v5.md`](FORUM-PROMPTS-v5.md)

1. **Fetch existing prompts** (+ approved/rejected examples) → trusted sources → long-running → RSS → Collect
2. **Fetch article bodies** – brødtekst for topp 12 URL-er
3. **Build agent input** → **Generate prompts (Ollama)**
4. **Build moderation input** → **Moderate prompts (Ollama)** – lærer av eksempler, structured JSON
5. **Prepare saves** → **Save prompt** (trusted → draft, AI-avslag → feedback-tabell)

Migrasjon **moderation feedback:** `20260603120000_forum_prompt_moderation_feedback.sql`

Deploy:

```bash
# v6 topology (første gang – erstatter «Moderation + route»)
node scripts/build-n8n-forum-prompts-v6-topology-ops.mjs /tmp/n8n-v6-topology.json

# kode + SQL + modereringsprompt
node scripts/build-n8n-forum-prompts-ops.mjs /tmp/n8n-v6-code-ops.json

# v5 topology (kun hvis «Fetch article bodies» mangler)
node scripts/build-n8n-forum-prompts-v5-topology-ops.mjs /tmp/n8n-forum-prompts-v5-topology-ops.json

# n8n MCP update_workflow (topology først ved nye noder, deretter code-ops)
```

**Opprydding feilaktige aktive prompts:** [`scripts/archive-misaligned-forum-prompts.sql`](../../scripts/archive-misaligned-forum-prompts.sql)

**v2 flyt:**

1. **Fetch long-running saker** (Postgres: `status=pending`, `first_seen_at` > 14 dager)
2. **Fetch RSS headlines** (parallell HTTP + bilde/video fra RSS)
3. **Collect all headlines** — flere SearXNG-queries, clustering, outlet-diversitet, opptil 28 artikler
4. **Ollama** → 6–10 prompts med 3–8 kilder per reel + valgfri `stortinget_issue_id`
5. `sensitivity: high` → `draft`; `low` → `active` (7 dagers `expires_at`)
6. UI: karusell med opptil 18 reels, utvidbare kilder, badge for langvarig sak

| Nøkkel | Backfill settings |
|--------|-------------------|
| `batchLimit` | `10` |
| `searxngBaseUrl` | f.eks. `https://searxng.heyklever.app` |
| `longRunningMinDays` | `14` |

Crons: 06:00 og 14:00 (n8n schedule triggers).

Webhook: `POST /webhook/folkets-forum-prompts` (env `N8N_FORUM_PROMPTS_WEBHOOK_URL`).

Krever migrasjon `20260531120000_production_readiness.sql` (`first_seen_at`, `stortinget_issue_id` på prompts).

## App cron (erstatter Vercel Cron)

Workflow-kilde: [`app-cron.workflow.ts`](app-cron.workflow.ts)

Vercel **Hobby** har ikke Cron Jobs (krever Pro). n8n scheduler kaller appens beskyttede endepunkter med header `x-cron-secret`.

| n8n schedule | App-endepunkt |
|--------------|---------------|
| Daglig 03:00 | `GET /api/cron/sync-issues` |
| Daglig 04:00 | `GET /api/cron/categories` |
| Daglig 07:00 | `GET /api/cron/digest?frequency=daily` |
| Mandag 07:30 | `GET /api/cron/digest?frequency=weekly` |

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
