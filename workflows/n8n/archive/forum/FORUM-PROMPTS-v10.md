# Forum Reels v10 – tre workflows, én agent hver

> **DEPRECATED (2026-06-07):** Erstattet av [FORUM-PROMPTS-v12.md](FORUM-PROMPTS-v12.md). Live v10-workflows arkivert: `j6NZpV4IHP0AHFVj`, `sb31mc2dmhIvdbRg`, `YY6u4GmeiZVk5R2e`.

| Workflow | Fil | Live ID | Agent | Webhook |
|----------|-----|---------|-------|---------|
| **1 Scout** | [`forum-research-discovery.workflow.ts`](forum-research-discovery.workflow.ts) | `j6NZpV4IHP0AHFVj` | Code ingest + 1 scout agent (+ SearXNG debatten) | `POST /webhook/folkets-forum-research-discovery` |
| **2 Journalist** | [`forum-story-research.workflow.ts`](forum-story-research.workflow.ts) | `sb31mc2dmhIvdbRg` | Research + journalist (+ SearXNG) | `POST /webhook/folkets-forum-research-journalist` |
| **3 Editor** | [`forum-story-editor.workflow.ts`](forum-story-editor.workflow.ts) | `YY6u4GmeiZVk5R2e` | Redaktør | Execute Workflow fra (2) eller `POST /webhook/folkets-forum-research-editor` |

Delte prompts/SQL: [`forum-workflow.shared.ts`](forum-workflow.shared.ts)

## Scout v11 (live `j6NZpV4IHP0AHFVj`)

Deterministisk ingest + én AI-agent for valg. Erstatter v10.1 batch/consolidate clustering.

| Steg | Type | Beskrivelse |
|------|------|-------------|
| Ingest and cluster | Code | 4 RSS × 12 → junk/politikk-filter → token-klynger → topp 5 kandidater |
| Story scout (Ollama) | Agent + SearXNG | Velger 1 klynge; `site:nrk.no/debatten` + 0–2 ekstra artikler |
| Enrich articles | Code | HTTP fetch → `source_payload` (excerpt, fetch_status, …) |
| Quality gate | IF | ≥2 kilder ok/partial før insert |

**DB:** `forum_research_articles.source_payload`, `forum_research_clusters.scout_metadata`, `politics_score` ved insert.

**Migrasjon:** `20260607120000_forum_scout_v11_source_payload.sql`

**Delte moduler:** [`forum-scout-ingest.shared.ts`](forum-scout-ingest.shared.ts)

## Prinsipper (v10)

- **Ingen Code-noder** – RSS Feed Read, Set, Postgres insert, Split Out, IF.
- **Ingen token-klynger til AI** – scout får nummererte RSS-linjer (1 og 1), velger **én sak**, supplerer med SearXNG om samme hendelse.
- **Én agent per workflow** – researcher+journalist slått sammen i workflow 2 (ett LLM-kall med ett formål).
- **Arkivér** `forum-trending-prompts` og `forum-research-synthesis` (multi-agent + mange Code-noder).

## Flyt

```text
[Cron/webhook scout]
  RSS NRK → Limit → scout-agent → Insert story + artikler
  status = pending_review

[Admin] /dashboard/admin/forum-clusters → Godkjenn
  → POST journalist webhook (N8N_FORUM_SYNTHESIS_WEBHOOK_URL)

[Journalist]
  processing → research+journalist agent → Execute Workflow editor

[Editor]
  moderator → forum_prompts (draft) → cluster completed

[Admin] /dashboard/admin/forum-prompts → Publiser
```

## Env

- `N8N_FORUM_SYNTHESIS_WEBHOOK_URL` → `https://n8n.heyklever.app/webhook/folkets-forum-research-journalist`
- Journalist → editor: `YY6u4GmeiZVk5R2e` (wired live; også i `forum-story-research.workflow.ts`)

## Deploy

```bash
node scripts/bundle-forum-research-discovery-workflow.mjs .tmp/forum-scout-v11-bundled.ts
# MCP: validate_workflow + create_workflow_from_code → TEMP_ID
node scripts/deploy-forum-scout-v11.mjs --temp-id <TEMP_ID> --publish

node scripts/bundle-forum-story-research-workflow.mjs /tmp/journalist.ts
node scripts/bundle-forum-story-editor-workflow.mjs /tmp/editor.ts
```

**Migrasjon:** Kjør `20260607120000_forum_scout_v11_source_payload.sql` på Supabase før første v11 scout-kjøring.

## Test

1. `curl -X POST "$N8N/webhook/folkets-forum-research-discovery" -d '{}'`
2. Én rad `forum_research_clusters` + artikler, `pending_review`
3. Godkjenn i admin → journalist kjører → `forum_prompts` draft
