# Forum Reels v13 – Stortinget-sak RAG prompt generator

Ny pipeline som lager JA/NEI-reels **direkte fra stortingssaker** med RAG (dokumentchunks + AI-sammendrag).

| Workflow | Kilde | Webhook |
|----------|--------|---------|
| **Sak-RAG prompt generator** | [`forum-sak-prompt-generator.workflow.ts`](forum-sak-prompt-generator.workflow.ts) · live `0LG3T8FwbhZ28vpQ` | `POST /webhook/folkets-forum-sak-prompt-generator` |

Kjører **parallelt** med v12 Regjeringen RSS — komplementerer nyhets-RSS med parlamentarisk substans.

## Flyt

```mermaid
flowchart LR
  Queue[Hent sak-kandidat] --> Embed[Ollama embed query]
  Embed --> RAG[match_issue_document_chunks]
  RAG --> Agent[Ollama JA/NEI-agent]
  Agent --> Draft[(forum_prompts draft)]
```

| Steg | Beskrivelse |
|------|-------------|
| **Sak-kø** | `pending` saker med `document_chunks.embedding_status = ready`, uten aktiv/draft prompt |
| **RAG** | Embed sak-tittel+sammendrag → top 8 chunks via `match_issue_document_chunks` |
| **Agent** | Ollama `gemma4:e2b-it-qat` (`think=false`, lav temperatur), uten n8n output parser |
| **Lagring** | `forum_prompts` draft med `stortinget_issue_id` + `generation_metadata` |

Output valideres i `SAK_PROMPT_GENERATOR_SAVE_JS`: workflowen trekker ut JSON fra
agent-svaret, avviser lav confidence, tomt spørsmål, manglende politisk valg
eller for lite kontekst, og lagrer kun gyldige utkast.

## Kandidatfilter og metrikker

Kandidater må være `pending`, ha minst én ready RAG-chunk, og ikke allerede ha
aktivt/draft prompt-utkast for samme `stortinget_issue_id`.

| Kilde | Bruk |
|-------|-----|
| `get_sak_prompt_coverage()` | Admin-metrikker: pending saker, pending med RAG, pending med prompt, kandidater |
| `lib/forum/sak-prompt-candidates.ts` | Admin kandidatlisten, maks 25 saker fra de 80 nyeste pending sakene |
| `lib/forum/sak-prompt-metrics.ts` | Draft/active sak-prompts og snitt RAG-chunks per draft |

## Env

```bash
N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL=https://n8n.heyklever.app/webhook/folkets-forum-sak-prompt-generator
```

## Deploy

```bash
N8N_API_KEY=... npm run deploy:forum-v13-sak-prompt -- --skip-test
```

Deploy-scriptet eksporterer workflow JSON fra SDK-kilden, henter Postgres- og
Ollama-credentials fra referanseworkflows, setter Ollama embeddings-URL, finner
eksisterende workflow ved navn/webhook path, oppdaterer eller oppretter den, og
aktiverer workflowen. Uten `--skip-test` kjører scriptet en webhook smoke test.

Hvis du trenger en ren TypeScript-bundle for manuell validering:

```bash
node scripts/bundle-forum-sak-prompt-generator-workflow.mjs /tmp/sak-prompt-generator.ts
```

## Test

```bash
# Neste kandidat i kø
curl -X POST "$N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL" -H "Content-Type: application/json" -d '{}'

# Spesifikk sak
curl -X POST "$N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"stortinget_issue_id":"200329"}'
```

## Delte moduler

- [`forum-sak-prompt.shared.ts`](forum-sak-prompt.shared.ts) — SQL, RAG merge, systemprompt, save
- [`lib/forum/sak-prompt-candidates.ts`](../../lib/forum/sak-prompt-candidates.ts) — admin kandidatliste
- [`lib/trigger-forum-sak-prompt-webhook.ts`](../../lib/trigger-forum-sak-prompt-webhook.ts) — app trigger

## DB

Migrasjon `20260621120000_forum_sak_rag_prompts.sql`:

- `forum_research_clusters.source_type` (`rss` | `stortinget_sak` | `votering` | `user_submission`)
- `forum_prompts.generation_metadata` (RAG chunks, confidence)
- `get_sak_prompt_coverage()` — admin-metrikker

## Admin

- Pipeline: `/dashboard/admin/forum-prompts?tab=pipeline` — se sak-kandidater + trigger
- Sak-side: «Generer reel-utkast» (kun forum-admin)
- API: `GET /api/admin/forum-sak-candidates`, `POST /api/admin/forum-sak-prompts`

## Review-sjekkliste (etter deploy)

1. Webhook produserer draft med `stortinget_issue_id`
2. Spørsmål er ikke overskrift-mal
3. `generation_metadata.rag_chunk_count` > 0 for RAG-grounded prompts
4. Admin kan publisere → karusell viser sak-lenke
5. v12 RSS-flyt uendret (`source_type = rss`)
