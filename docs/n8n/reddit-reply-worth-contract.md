# n8n — Reddit svarverdi (`reply_worth`)

Kontrakt for fase 1 av [Reddit-svarassistent-planen](../superpowers/plans/2026-11-22-reddit-reply-assistant.md).
Scorer om et interessesignal er **verdt et menneskelig svar** — skilt fra `ai_relevance` (research).

**Ingen selftext / author / comments lagres.** Klassifisering bruker kun metadata.

## Migrasjon

`supabase/migrations/20261122140000_reddit_reply_worth.sql` (manuell apply).

Kolonner på `public.reddit_signals`:

| Kolonne | Type | Merknad |
|---------|------|---------|
| `reply_worth` | smallint 1–5 \| null | Score |
| `reply_worth_reason` | text | Kort bokmål |
| `reply_worth_model` | text | f.eks. `gemma4:26b` |
| `reply_worth_scored_at` | timestamptz | |
| `reply_worth_status` | `pending` \| `scored` \| `skipped` \| `failed` | default `pending` |
| `reply_gate_passes` | boolean \| null | Heuristikk |

## Auth

Samme som øvrige n8n → Supabase: **service_role** only (`REVOKE` fra PUBLIC/anon/authenticated).

## RPC: `n8n_list_reddit_reply_worth_candidates`

```http
POST {SUPABASE_URL}/rest/v1/rpc/n8n_list_reddit_reply_worth_candidates
```

```json
{ "p_limit": 5 }
```

`p_limit` clamps 1–25. Soft SQL-prefilter: `reply_worth_status=pending`, `status=ny`, `posted_at` ≤ 72 t, `score≥5`, `num_comments` 3–150, `removal_type` null.

Returnerer rader med: `id`, `reddit_id`, `subreddit`, `title`, `score`, `num_comments`, `contention`, `flair`, `removal_type`, `status`, `posted_at`, `related_issue_id`, `related_issue_title`, `reply_worth_status`.

## RPC: `n8n_set_reddit_reply_worth`

```json
{
  "p_reddit_id": "abc123",
  "p_status": "scored",
  "p_worth": 4,
  "p_reason": "Åpent samfunnsspørsmål",
  "p_model": "gemma4:26b",
  "p_gate_passes": true
}
```

| `p_status` | Krav |
|------------|------|
| `scored` | `p_worth` 1–5 |
| `skipped` / `failed` | `p_worth` valgfri (beholdes uendret) |
| `pending` | nuller score-felter (re-kø) |

Suksess: `{ "ok": true, "reddit_id", "reply_worth", "reply_worth_status", "reply_gate_passes" }`.  
Feil: `{ "ok": false, "error": "invalid_reddit_id" \| "invalid_status" \| "invalid_worth" \| "not_found" }`.

## Workflow

Kilde: `workflows/n8n/reddit-reply-worth.workflow.ts` (+ `.shared.ts`).

1. Schedule hvert 15. minutt  
2. List candidates  
3. Deterministisk gate (speiler `lib/reddit-signals/reply-worth-gate.ts`)  
4. Fail → `skipped`  
5. Pass → Ollama JSON `{ worth, reason }` → `scored` / `failed`

**Deploy:** eier-prosess i n8n. Ikke importer JSON til prod uten godkjenning.

## Admin UI

`/dashboard/admin/research?view=signaler` — sort `reply_worth`, filter `worth=1` («Kun verdt å svare», score ≥ 4), badge «Verdt å svare».
