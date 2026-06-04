# Forum Reels v8 – én pipeline (discovery + synthesis)

Kilde: [`forum-research-discovery.workflow.ts`](forum-research-discovery.workflow.ts)  
Delte moduler: [`forum-prompt-ingest.shared.ts`](forum-prompt-ingest.shared.ts), [`forum-prompt-synthesis.shared.ts`](forum-prompt-synthesis.shared.ts), [`forum-article-enrich.shared.ts`](forum-article-enrich.shared.ts)

## Hva endret seg fra v7

| v7 (fjernet) | v8 |
|--------------|-----|
| To workflows (discovery + synthesis) | **Én** workflow |
| HTTP SearXNG i Code | **SearXNG tool** på discovery-agent |
| `Has clusters?` / `Has headlines?` | Tom input → `return []` i Code |
| Stortinget-overskrift fallback | **Ingen** fallback – tom output |
| `recencyBoost` uten filter | **Hard** `maxArticleAgeHours` (default 72) + år-i-tittel |
| Én generate-agent | **Researcher → Journalist → Editor** + Code finalize |

## Live workflow

| Workflow | ID | Webhook |
|----------|-----|---------|
| Forum research (v8) | `mjiQBSdxVv0sAuMu` | `POST /webhook/folkets-forum-research-discovery` |

Arkiver/deaktiver synthesis `MloIdsnX7FozM4dv` etter deploy.

## Flyt

```text
RSS → Cluster (72t-filter) → Discover (+ SearXNG tool) → Enrich articles
  → Save clusters/articles → per cluster:
    Deep research → Journalist (1 spørsmål) → Editor → Finalize → forum_prompts
```

## Kvalitetsregler (kode, ikke bare LLM)

- Maks **1** godkjent reel per cluster per kjøring
- Dedup mot `existing_questions` + `savedQuestionsThisRun` (workflow static data)
- Avvis: Stortinget-mal, overskrift i `«…»`, utdatert år (f.eks. statsbudsjett 2024 i 2026)
- RSS-artikler uten `publishedAt` innen vindu droppes

## Credentials (n8n)

| Credential | Bruk |
|------------|------|
| Fokets Meninger | Postgres |
| Ollama account | Alle Ollama-agenter |
| SearXNG account (`s4sozm3pIpMRVfYD`) | Discovery-agent tool |

## Deploy

```bash
node scripts/bundle-forum-research-discovery-workflow.mjs
# n8n MCP: validate_workflow (bundled) → create_workflow_from_code → GET → /tmp/n8n-v8-workflow.json
node scripts/deploy-forum-v8-n8n.mjs   # PUT mjiQBSdxVv0sAuMu + cred merge + archive MloIdsnX7FozM4dv

# Test
curl -X POST "https://n8n.heyklever.app/webhook/folkets-forum-research-discovery" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

Kode-tweaks uten full topologi: `node scripts/build-n8n-forum-research-discovery-ops.mjs`

**Etter SDK-deploy:** SDK `subnodes` eksporteres ikke alltid som n8n-noder. Kjør da:
`node scripts/fix-forum-v8-ollama-subnodes.mjs` (legger til Ollama-modeller, parsere, SearXNG, check_duplicate + `ai_*`-koblinger).

**SearXNG:** Ikke sett `options` (språk, `numResults`, osv.) i n8n — la instansen bruke egne defaults. Ved `Bad Request` fra tool-noden: sjekk SearXNG-credential (kun base-URL), ikke overstyring i workflow.

**Code-noder:** `node scripts/patch-forum-v8-code-nodes.mjs` (unescaper `\\` fra TS → gyldig JS i n8n).

Cron: kun discovery-workflow (`0 * * * *`). Fjern `:30` synthesis-cron.
