# n8n — Research-webhook (utdyp / blogg / Reel)

Kontrakt mellom fm-web admin Research og n8n. Resultat skrives til `public.research_briefs` via PostgREST-RPC med **service_role** (credential «Folkets Stemme Self-hosted»).

Miljø på **fm-web** (Coolify):

| Variabel | Beskrivelse |
|----------|-------------|
| `N8N_RESEARCH_WEBHOOK_BASE` | Base-URL uten avsluttende `/`, f.eks. `https://n8n.example/webhook` |
| `N8N_RESEARCH_WEBHOOK_SECRET` | HMAC-nøkkel for `X-FM-Signature` (aldri logg eller vis) |
| `N8N_RESEARCH_WEBHOOK_TOKEN` | **Egen** statisk token for `X-FM-Webhook-Token` — ikke samme verdi som `N8N_RESEARCH_WEBHOOK_SECRET`. Brukes i n8n Webhook Header Auth (uten env i Code-noder). Aldri logg. |

Mangler base, secret eller token: fm-web **kaller ikke** webhook; brief settes til `failed` med generisk `error=arbeidsflyt_utilgjengelig`.

## Utkøring fra admin

`POST /api/admin/research/{clusterId}/{action}` med `action` ∈ `deepen` | `blog` | `reel`.

1. Kjører `research_briefs_expire_stale` (standard 30 min) slik at gamle `queued`/`running` blir `failed` med `error=tidsavbrudd`.
2. Oppretter rad i `research_briefs` (`status=queued`, ny `request_id`) hvis ingen aktiv jobb for samme klynge+kind.
3. POST til n8n (se under).
4. Ved webhook-feil: `status=failed`, fm-web returnerer **502**.

fm-web kaller også `research_briefs_expire_stale` før lesing på Research-liste og klynge-detalj.

## Webhook-URL

`POST ${N8N_RESEARCH_WEBHOOK_BASE}/{path}`

| action (fm-web) | path |
|-----------------|------|
| deepen | `research-utdyp` |
| blog | `blogg-fra-research` |
| reel | `reel-fra-research` |

## Signatur og auth

Headers:

- `X-FM-Timestamp` — Unix-tid i sekunder (streng).
- `X-FM-Signature` — `sha256=<hex>` hvor hex = HMAC-SHA256(`N8N_RESEARCH_WEBHOOK_SECRET`, ``${timestamp}.${rawBody}``) og `rawBody` er eksakt JSON-body (UTF-8).
- `X-FM-Webhook-Token` — verdien av `N8N_RESEARCH_WEBHOOK_TOKEN` (Header Auth i n8n Webhook-node).

n8n avviser forespørsler med klokkeskew > 300 s.

## Request body (JSON)

Felter felles for alle `kind`:

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
  }
}
```

For **`kind` blog og reel** legges til:

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `source_request_id` | `uuid` \| `null` | `request_id` for **seneste** `deepen`-brief med `status=done` på samme `cluster_id`. `null` hvis ingen slik brief finnes. |
| `latest_brief` | objekt (valgfritt) | **Snapshot** av seneste brief på klyngen (uavhengig av kind) når den finnes — kun `summary`, `perspectives`, `sources`. Ikke autoritativ; bruk `n8n_get_research_brief` for gjeldende rad. |

Eksempel (blog/reel):

```json
{
  "request_id": "…",
  "kind": "blog",
  "cluster_id": "…",
  "source_request_id": "uuid-av-siste-fullførte-utdyp",
  "latest_brief": {
    "summary": "…",
    "perspectives": [],
    "sources": []
  },
  "action_key": "…",
  "requested_by": "…",
  "requested_at": "…",
  "cluster": { }
}
```

## Respons fra n8n

**202 Accepted** umiddelbart (asynkron jobb). Ingen publisering skjer automatisk.

## Livssyklus (alle kinds)

`queued` → `running` → `done` | `failed`

- `done` og `failed` er **terminale**. Ny kjøring = ny `request_id` fra admin.
- Forsøk på bakovergang (f.eks. `running` etter `done`) er **no-op**: RPC returnerer gjeldende rad uten endring.
- Alle `p_*` i `n8n_upsert_research_brief`: **NULL = behold lagret verdi** (`COALESCE`).

## Skriving tilbake (service_role)

### Les brief

`POST /rest/v1/rpc/n8n_get_research_brief`

```json
{ "p_request_id": "uuid" }
```

Returnerer **`jsonb` eller SQL `NULL`** (PostgREST: `null` i JSON) når raden ikke finnes.

Når funnet, nøyaktig disse nøklene (ingen `ok` / `id`):

`request_id`, `cluster_id`, `kind`, `status`, `summary`, `details`, `perspectives`, `sources`, `output_ref`, `error`, `requested_by`, `created_at`, `updated_at`

### Oppdater status / innhold

`POST /rest/v1/rpc/n8n_upsert_research_brief`

```json
{
  "p_request_id": "uuid",
  "p_status": "running",
  "p_summary": "…",
  "p_perspectives": [],
  "p_sources": [],
  "p_details": { "open_questions": [], "unverified": [] },
  "p_error": null
}
```

`p_status` ∈ `queued` | `running` | `done` | `failed`. Rad må finnes (opprettet av fm-web). Returnerer **hele raden** som `jsonb` (ikke exception ved duplikat-kall).

**perspectives** (JSON-array, ukjente nøkler tillates):

Påkrevd per element: `actor`, `actor_type`, `stance`, `summary`. Valgfritt bl.a. `quotes` (array), **`independent`** (bool, om perspektivet er uavhengig av klyngen).

```json
[
  {
    "actor": "Arbeiderpartiet",
    "actor_type": "parti",
    "stance": "for",
    "summary": "…",
    "independent": false,
    "quotes": [
      { "text": "…", "url": "https://…", "publisher": "nrk.no" }
    ]
  }
]
```

`actor_type` ∈ `parti` | `organisasjon` | `medie` | `person` | `annet`  
`stance` ∈ `for` | `mot` | `nøytral`

**sources** (JSON-array, ukjente nøkler tillates):

Påkrevd per element: `url`. Valgfritt bl.a. `publisher`, `title`, `published_at`, `excerpt`, `source_kind`, `domain`, `used`, `text_status`, `source_urls`, `basis`.

```json
[
  {
    "url": "https://…",
    "publisher": "nrk.no",
    "title": "…",
    "published_at": "2026-01-01T00:00:00Z",
    "excerpt": "…",
    "used": true
  }
]
```

**details** (JSON-objekt, valgfritt): f.eks. `open_questions[]`, `unverified[]`.

### Output-referanse (utkast)

`POST /rest/v1/rpc/n8n_set_research_output`

```json
{
  "p_request_id": "uuid",
  "p_output_ref": "payload-post-id eller poll-uuid"
}
```

Setter `output_ref` og `status=done` når ikke allerede terminalt. Idempotent når samme `output_ref` finnes.

### Blogg

n8n oppretter Payload-utkast via `POST /api/ops/blog/drafts` (fm-web, `x-cron-secret`):

- `category`: `forklart` (standard om utelatt)
- `source_event`: `research:<request_id>` (idempotent oppslag)
- `review_note`: valgfri tekst til Payload `review.note`

`p_output_ref` = Payload post-id etter opprettelse. Redaktør godkjenner i Payload-admin.

### Reel

`POST /rest/v1/rpc/n8n_create_research_reel_draft`

```json
{
  "p_request_id": "uuid",
  "p_issue_id": "valgfri stortinget-sak-id",
  "p_title": "…",
  "p_neutral_summary": "…",
  "p_source_urls": ["https://…"],
  "p_generation_metadata": {}
}
```

Låser brief-raden (`FOR UPDATE`) i **én transaksjon**. Hvis `output_ref` allerede er satt: returnerer `{ "poll_id": "<uuid>", "created": false }` med eksisterende poll. Ellers kalles `create_system_poll_draft` med `generation_metadata` som inkluderer `origin: "research"` og `research_request_id`, deretter settes `output_ref = poll_id` og `status = done` på brief-raden.

**Retur (kun disse nøklene):**

```json
{ "poll_id": "uuid", "created": true }
```

eller ved duplikat:

```json
{ "poll_id": "uuid", "created": false }
```

### Timeout

`POST /rest/v1/rpc/research_briefs_expire_stale`

```json
{ "p_minutes": 30 }
```

Setter `queued`/`running` med `updated_at` eldre enn N minutter til `failed` / `error=tidsavbrudd`. Kalles også fra fm-web før lesing og ny bestilling.

## Migrasjon

`supabase/migrations/20261021130000_research_briefs.sql` — **manuell apply** på prod. Ingen embedding-kolonner i v1; hvis de legges til senere, bruk **bge-m3** og `vector(1024)`.
