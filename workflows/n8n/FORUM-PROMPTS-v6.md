# Forum trending prompts v6 – AI-moderering med læring

Kilde: [`forum-trending-prompts.workflow.ts`](forum-trending-prompts.workflow.ts)  
Live workflow: https://n8n.heyklever.app/workflow/MloIdsnX7FozM4dv

## Endring fra v5

| v5 | v6 |
|----|-----|
| **Moderation + route** (~600 linjer Code) | **Moderate prompts (Ollama)** – AI-agent med structured output |
| Regex/fallback-regler i kode | Læring fra godkjente/avslåtte eksempler i prompt |
| Ingen feedback-løkke | `forum_prompt_moderation_feedback` + admin-trigger |

## Pipeline

```
Generate prompts → Build moderation input → Moderate prompts (Ollama) → Prepare saves → Save prompt
```

### Læring over tid

1. **Fetch existing prompts** henter `approved_examples` (aktive) og `rejected_examples` (arkiverte).
2. **Build moderation input** injiserer eksemplene i modereringsprompten.
3. **Admin-handlinger** (aktiver/arkiver i CMS) logges via DB-trigger etter migrasjon `20260603120000_forum_prompt_moderation_feedback.sql`.
4. **AI-avslag** logges i `forum_prompt_moderation_feedback` med `source='ai'`.

### Noder

| Node | Rolle |
|------|--------|
| Build moderation input | Parser generator-output, bygger modereringstekst med eksempler |
| Moderate prompts (Ollama) | llama3.1:8b, JSON output `{approved_prompts, rejected}` |
| Prepare saves | Kartlegger kilder, trusted check, SQL (ingen regex-moderering) |

## Deploy

```bash
# 1) Kjør migrasjon (feedback-tabell + trigger)
# supabase db push / kjør 20260603120000_forum_prompt_moderation_feedback.sql

# 2) Topology (første gang v6)
node scripts/build-n8n-forum-prompts-v6-topology-ops.mjs /tmp/n8n-v6-topology.json
# n8n MCP update_workflow

# 3) Kode + SQL
node scripts/build-n8n-forum-prompts-ops.mjs /tmp/n8n-v6-code-ops.json
# n8n MCP update_workflow (ev. i batches)
```

## v5-dokumentasjon

Artikkelhenting, agent-tools og kildekrav er uendret – se [`FORUM-PROMPTS-v5.md`](FORUM-PROMPTS-v5.md).
