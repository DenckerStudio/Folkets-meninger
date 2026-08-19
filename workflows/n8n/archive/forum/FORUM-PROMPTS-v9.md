# Forum Reels v9 – to-trinns redaktør-godkjenning

Kilde discovery: [`forum-research-discovery.workflow.ts`](forum-research-discovery.workflow.ts)  
Kilde syntese: [`forum-research-synthesis.workflow.ts`](forum-research-synthesis.workflow.ts)  
Delte moduler: [`forum-prompt-ingest.shared.ts`](forum-prompt-ingest.shared.ts), [`forum-prompt-synthesis.shared.ts`](forum-prompt-synthesis.shared.ts), [`forum-article-enrich.shared.ts`](forum-article-enrich.shared.ts)

v8 (én pipeline) er erstattet av **discovery → menneskelig steg 1 → syntese → menneskelig steg 2 (utkast)**.

## Flyt

```text
[Cron/webhook discovery]
  RSS → cluster → Discover (+ SearXNG) → enrich → DB
  forum_research_clusters.status = pending_review

[Admin steg 1] /dashboard/admin/forum-clusters
  Godkjenn → status approved → POST synthesis webhook
  Avslå   → status rejected

[Webhook synthesis] per clusterId
  processing → enrich → deep research (+ SearXNG, ingen tool options)
  → journalist → editor → forum_prompts status=draft
  → cluster status completed

[Admin steg 2] /dashboard/admin/forum-prompts (fanen Godkjenn utkast)
  Publiser → active | Arkiver → archived
```

## Status (DB)

### `forum_research_clusters.status`

| Verdi | Betydning |
|-------|-----------|
| `pending_review` | Oppdaget, venter redaktør (steg 1) |
| `approved` | Godkjent, webhook sendt (kortvarig før processing) |
| `processing` | Syntese kjører i n8n |
| `completed` | Utkast lagret (eller ingen godkjent prompt) |
| `rejected` | Avslått i admin |
| `failed` | Teknisk feil (reservert) |

Migrasjon: `supabase/migrations/20260604120000_forum_research_two_step.sql` (mapper gammel `pending` → `pending_review`).

### `forum_prompts.status`

Uendret: `draft` → admin publiserer → `active`.

## n8n workflows

| Workflow | ID (live, etter deploy) | Webhook |
|----------|-------------------------|---------|
| Discovery v9 | `mjiQBSdxVv0sAuMu` (oppdater eksisterende) | `POST /webhook/folkets-forum-research-discovery` |
| Synthesis v9 | *ny workflow* | `POST /webhook/folkets-forum-research-synthesis` body `{"clusterId":"<uuid>"}` |

App-env: `N8N_FORUM_SYNTHESIS_WEBHOOK_URL` = full produksjons-URL til synthesis-webhook.

## Admin-URLer

| Steg | URL |
|------|-----|
| 1 – saker | `/dashboard/admin/forum-clusters` |
| 2 – utkast | `/dashboard/admin/forum-prompts` (fanen «Godkjenn utkast») |

API: `GET/PATCH /api/admin/forum-clusters`, eksisterende `/api/admin/forum-prompts`.

## Deploy

```bash
# DB
supabase db push   # 20260604120000_forum_research_two_step.sql

# Discovery (oppdater mjiQBSdxVv0sAuMu)
node scripts/bundle-forum-research-discovery-workflow.mjs /tmp/forum-discovery-bundled.ts
# n8n MCP: create_workflow_from_code (temp) → deploy:
node scripts/deploy-forum-v8-n8n.mjs --temp-workflow-id=<tempId>

# Synthesis (ny workflow)
node scripts/bundle-forum-research-synthesis-workflow.mjs /tmp/forum-synthesis-bundled.ts
# n8n MCP: create_workflow_from_code → aktiver webhook → noter ID og URL i .env

node scripts/fix-forum-v8-ollama-subnodes.mjs   # på begge workflows etter SDK-deploy
node scripts/patch-forum-v8-code-nodes.mjs      # discovery + synthesis
```

**SearXNG:** Tom `parameters: {}` på tool-noder – ingen `options` i workflow. Ved `Bad Request`: sjekk credential base-URL og korte søk (≤6 ord).

## Manuell testplan

1. Kjør migrasjon på Supabase-prosjektet.
2. Sett `N8N_FORUM_SYNTHESIS_WEBHOOK_URL` og `FORUM_ADMIN_EMAILS` i app-miljø.
3. `curl -X POST "$N8N_BASE/webhook/folkets-forum-research-discovery" -H "Content-Type: application/json" -d '{"force":true}'`
4. Verifiser rader i `forum_research_clusters` med `status=pending_review` og artikler i `forum_research_articles`.
5. Logg inn som forum-admin → `/dashboard/admin/forum-clusters` → godkjenn én sak.
6. Følg n8n execution på synthesis-workflow; forvent `forum_prompts` med `status=draft` og `research_cluster_id` satt.
7. `/dashboard/admin/forum-prompts` → publiser utkast → `active` og synlig i Forum Reels.

## Gjenstående gap

- SearXNG `Bad Request` på noen instanser (credential/instans-defaults).
- Kvalitetstuning (journalist/editor prompts, Ollama `numCtx`).
- Automatisk retry hvis synthesis-webhook feiler mens cluster står på `approved`.
- v8-dokumentasjon i [`FORUM-PROMPTS-v8.md`](FORUM-PROMPTS-v8.md) er historisk; bruk denne filen for drift.
