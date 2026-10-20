# n8n — content feedback og kilder (F1)

Kontrakt mellom n8n og Supabase for `content_feedback`, `content_sources`, `source_items` og `feedback_profile` (migrasjon `20261021120000_content_feedback.sql`). **Ikke auto-appliert på prod** — Coolify Expert kjører SQL manuelt etter godkjenning.

Embeddings: **bge-m3**, `vector(1024)` (ikke nomic/768).

## Autentisering

| Felt | Verdi |
|------|--------|
| Credential (navn i n8n) | **Folkets Stemme Self-hosted** (service role) |
| Header | `apikey: <SUPABASE_SERVICE_ROLE_KEY>` |
| Header | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Content-Type | `application/json` |

Alle `n8n_*`-RPC-er og `upsert_content_feedback` er kun `GRANT EXECUTE` til `service_role`.

## Domener

`normalize_content_source_domain(domain)` lowercaser og fjerner ledende `www.`.  
`www.utenfilter.no` og `utenfilter.no` peker på samme `content_sources`-rad (`utenfilter.no`).

Seed for Uten Filter:

- `tier`: `primary`, `base_weight`: `1.5`
- `ingest.base_url`: `https://www.utenfilter.no`
- `ingest.url`: `https://www.utenfilter.no/wp-json/wp/v2/posts?per_page=20`

## HTTP: `n8n_upsert_source_items`

```http
POST {SUPABASE_URL}/rest/v1/rpc/n8n_upsert_source_items
```

Body:

```json
{
  "p_items": [
    {
      "domain": "www.utenfilter.no",
      "external_id": "12345",
      "url": "https://www.utenfilter.no/…",
      "title": "…",
      "excerpt": "…",
      "categories": ["EU", "Energi"],
      "published_at": "2026-10-20T08:00:00Z",
      "modified_at": "2026-10-20T09:00:00Z",
      "embedding": "[0.1, …]",
      "embedding_model": "bge-m3"
    }
  ]
}
```

**Retur:**

```json
{
  "upserted": 2,
  "skipped": [
    { "index": 1, "external_id": "bad", "reason": "url er påkrevd for ny rad …" }
  ]
}
```

- Én ugyldig rad **avviser ikke** hele batchen.
- `categories`: utelatt eller JSON `null` → tom array; annen type → rad i `skipped`.
- **Ny rad:** `url` og `title` påkrevd.
- **Eksisterende rad:** `url`/`title` valgfritt (beholdes med `COALESCE`).
- `embedding` / `embedding_model`: overskrives ikke med `null` eller `''`.
- `modified_at` / `published_at` / `fetched_at`: ved oppdatering endres bare når feltet sendes; utelatt `modified_at` beholder gammel verdi (ingen `now()`-fallback).

Dedupe: `(domain, external_id)` etter normalisering.

## HTTP: `n8n_list_source_items`

```http
POST {SUPABASE_URL}/rest/v1/rpc/n8n_list_source_items
```

```json
{
  "p_domain": "utenfilter.no",
  "p_since": "2026-10-01T00:00:00Z",
  "p_limit": 500
}
```

Returnerer rader med `id`, `domain`, `external_id`, `url`, `title`, `categories`, `published_at`, `modified_at`, `has_embedding` (ingen rå vektor). Sortering: `COALESCE(modified_at, published_at)` DESC.

## HTTP: `n8n_match_source_items`

```json
{
  "p_embedding": "<vector(1024)>",
  "p_days": 14,
  "p_k": 5
}
```

Tidsvindu: `COALESCE(published_at, fetched_at)` (rader uten `published_at` faller ikke ut).

## Andre n8n-RPC-er

| RPC | Formål |
|-----|--------|
| `n8n_feedback_examples(p_type, p_query_embedding, p_k)` | Few-shot (nyeste + mest like approve/reject) |
| `n8n_feedback_similarity(p_type, p_embedding)` | `max_sim_approved`, `max_sim_rejected`, `n_rejected_similar` |
| `n8n_set_feedback_embedding(p_id, p_embedding)` | Lagre embedding på aktiv `content_feedback`-rad |
| `n8n_upsert_feedback_profile(p_type, p_profile, p_calibration)` | Nattlig profil |

Alle embedding-parametre valideres til dimensjon **1024**.

## fm-web (ikke n8n)

`upsert_content_feedback` — admin-tilbakemelding via `/api/admin/content-feedback` (F2), `service_role` + `requireAdmin()`.
