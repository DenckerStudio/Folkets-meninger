# n8n — Research-webhook (utdyp / blogg / Reel)

Kontrakt mellom fm-web admin Research og n8n. Resultat skrives til `public.research_briefs` via PostgREST-RPC med **service_role** (credential «Folkets Stemme Self-hosted»).

Miljø på **fm-web** (Coolify):

| Variabel | Beskrivelse |
|----------|-------------|
| `N8N_RESEARCH_WEBHOOK_BASE` | Base-URL uten avsluttende `/`, f.eks. `https://n8n.example/webhook` |
| `N8N_RESEARCH_WEBHOOK_SECRET` | HMAC-nøkkel for `X-FM-Signature` (aldri logg eller vis) |

## Utkøring fra admin

`POST /api/admin/research/{clusterId}/{action}` med `action` ∈ `deepen` | `blog` | `reel`.

1. Oppretter rad i `research_briefs` (`status=queued`, ny `request_id`).
2. POST til n8n (se under).
3. Ved webhook-feil: `status=failed`, fm-web returnerer **502**.

## Webhook-URL

`POST ${N8N_RESEARCH_WEBHOOK_BASE}/{path}`

| action (fm-web) | path |
|-----------------|------|
| deepen | `research-utdyp` |
| blog | `blogg-fra-research` |
| reel | `reel-fra-research` |

## Signatur

Headers:

- `X-FM-Timestamp` — Unix-tid i sekunder (streng).
- `X-FM-Signature` — `sha256=<hex>` hvor hex = HMAC-SHA256(`N8N_RESEARCH_WEBHOOK_SECRET`, ``${timestamp}.${rawBody}``) og `rawBody` er eksakt JSON-body (UTF-8).

n8n avviser forespørsler med klokkeskew > 300 s.

## Request body (JSON)

```json
{
  "request_id": "uuid",
  "kind": "deepen",
  "cluster_id": "uuid",
  "action_key": "opprop:…",
  "requested_by": "uuid",
  "requested_at": "2026-10-20T10:00:00.000Z",
  "cluster": {
    "title": "…",
    "summary": "…",
    "status": "candidate",
    "sources": [
      {
        "url": "https://…",
        "publisher": "nrk.no",
        "title": "…",
        "published_at": "2026-01-01T00:00:00Z",
        "source_type": "news_rss"
      }
    ]
  },
  "latest_brief": {
    "summary": "…",
    "perspectives": [],
    "sources": []
  }
}
```

`latest_brief` sendes for `kind` **blog** og **reel** når en tidligere brief finnes; utelates ellers.

## Respons fra n8n

**202 Accepted** umiddelbart (asynkron jobb). Ingen publisering skjer automatisk.

## Skriving tilbake (service_role)

### Oppdater status / innhold

`POST /rest/v1/rpc/n8n_upsert_research_brief`

```json
{
  "p_request_id": "uuid",
  "p_status": "running",
  "p_summary": "…",
  "p_perspectives": [],
  "p_sources": [],
  "p_error": null
}
```

`p_status` ∈ `queued` | `running` | `done` | `failed`. Idempotent på `request_id` (rad må finnes fra fm-web).

**perspectives** (JSON-array):

```json
[
  {
    "actor": "Arbeiderpartiet",
    "actor_type": "parti",
    "stance": "for",
    "summary": "…",
    "quotes": [
      { "text": "…", "url": "https://…", "publisher": "nrk.no" }
    ]
  }
]
```

`actor_type` ∈ `parti` | `organisasjon` | `medie` | `person` | `annet`  
`stance` ∈ `for` | `mot` | `nøytral`

**sources** (JSON-array):

```json
[
  {
    "url": "https://…",
    "publisher": "nrk.no",
    "title": "…",
    "published_at": "2026-01-01T00:00:00Z",
    "excerpt": "…"
  }
]
```

### Output-referanse (utkast)

`POST /rest/v1/rpc/n8n_set_research_output`

```json
{
  "p_request_id": "uuid",
  "p_output_ref": "payload-post-id eller poll-uuid"
}
```

Setter `output_ref` og `status=done`.

### Blogg

n8n oppretter Payload-utkast via eksisterende `POST /api/ops/blog/drafts` (fm-web). `p_output_ref` = Payload post-id. Redaktør godkjenner i Payload-admin.

### Reel

n8n oppretter system-poll-utkast via `create_system_poll_draft`. `p_output_ref` = poll-id. Admin godkjenner i Reels-admin som i dag.

## Migrasjon

`supabase/migrations/20261021130000_research_briefs.sql` — **manuell apply** på prod (samme regler som andre migrasjoner). Ingen embedding-kolonner i v1; hvis de legges til senere, bruk **bge-m3** og `vector(1024)`.
