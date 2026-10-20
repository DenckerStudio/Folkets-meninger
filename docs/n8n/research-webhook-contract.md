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

**Utløpte jobber:** fm-web kaller `research_briefs_expire_stale` kun ved **ny bestilling** (steg 1). Lesing av Research-liste og klynge-detalj gjør **ikke** expire. n8n skal kjøre `research_briefs_expire_stale` på **fast schedule** (anbefalt hvert **10. minutt**, `p_minutes: 30`) med service_role.

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
- **Heartbeat:** n8n skal sende heartbeat **minst hvert 20. minutt** (`n8n_upsert_research_brief` med `p_status=running` eller `queued` og NULL på andre felt). Utløp (`research_briefs_expire_stale`, standard **30 min** uten aktivitet på `updated_at`) tåler typisk n8n-gap på inntil ~15 min. Et bakovergående status-kall (f.eks. `queued` på en `running`-rad) er **no-op** for status, men oppdaterer likevel `updated_at`.
- Valgfritt på alle n8n-RPC-er: `p_cluster_id` / `p_kind` — når satt, må de matche raden; ellers `research_request_conflict` (`P0001`).

## Feilkoder (n8n + fm-web)

n8n kan matche på **eksakt** `RAISE EXCEPTION`-melding (PostgREST `message`) og SQLSTATE.

| Melding | SQLSTATE | Når |
|---------|----------|-----|
| `research_brief_failed` | `P0001` | `n8n_create_research_reel_draft` på brief med `status=failed` |
| `research_request_conflict` | `P0001` | `request_id` finnes med annen `cluster_id` eller `kind` (RPC scope eller `research_briefs_enqueue`) |
| `research_brief_active` | `P0001` | Aktiv `queued`/`running` finnes for samme `(cluster_id, kind)` (`research_briefs_enqueue`; `DETAIL` = aktiv `request_id`) |
| `research_invalid_input` | `22023` | Ugyldig input; `DETAIL` **eksakt** `felt p_<navn>` (n8n parser feltnavnet derfra), f.eks. `felt p_generation_metadata`, `felt p_source_urls`, `felt p_summary` |

**fm-web admin** `POST /api/admin/research/{clusterId}/{action}` ved 409:

| `error` | Body |
|---------|------|
| `research_request_conflict` | `{ "error": "research_request_conflict" }` |
| `research_brief_active` | `{ "error": "research_brief_active", "request_id": "<uuid>" }` |

fm-web oppretter rader via `research_briefs_enqueue` (service_role), ikke direkte `INSERT`.

## Skriving tilbake (service_role)

### Les brief

`POST /rest/v1/rpc/n8n_get_research_brief`

```json
{
  "p_request_id": "uuid",
  "p_cluster_id": "uuid (valgfritt)",
  "p_kind": "deepen | blog | reel (valgfritt)"
}
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
  "p_error": null,
  "p_cluster_id": "uuid (valgfritt)",
  "p_kind": "deepen | blog | reel (valgfritt)"
}
```

`p_status` ∈ `queued` | `running` | `done` | `failed`. Rad må finnes (opprettet av fm-web). Returnerer **hele raden** som `jsonb` (ikke exception ved duplikat-kall).

**`p_error`** (valgfritt, maks **500** tegn): enten en **kjent kode** (lagres som-is) eller **kort fri norsk tekst** (vises i admin som ren tekst, ikke HTML). fm-web mapper kjente koder til norske meldinger (`lib/admin/research/error-messages.ts`).

| Kode | Betydning i UI |
|------|----------------|
| `tidsavbrudd` | Oppgaven ble avbrutt etter for lang ventetid i kø. |
| `arbeidsflyt_utilgjengelig` | Arbeidsflyten er ikke tilgjengelig akkurat nå. |
| `modell_feil` | Modellen kunne ikke fullføre oppgaven. |
| `kilder_mangler` | Det mangler kilder for å fullføre oppgaven. |
| `cms_feil` | Kunne ikke opprette eller oppdatere innhold i CMS. |
| `ugyldig_svar` | Arbeidsflyten returnerte et ugyldig svar. |
| `avbrutt` | Oppgaven ble avbrutt. |

Andre strenger behandles som fri feilmelding (trimmes, maks 500 tegn). fm-web kan sette `webhook_http_<status>` ved webhook-feil; UI mapper prefikset til generisk nettverksmelding.

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
  "p_source_urls": [
    { "label": "NRK", "url": "https://…" },
    { "url": "/dashboard/saker/12345" }
  ],
  "p_generation_metadata": {}
}
```

`p_source_urls`: JSON-array (maks **20** elementer), samme format som `create_system_poll_draft` / Reels-workflow: objekter med påkrevd `url` (`http://`, `https://` eller app-sti som starter med `/`). Valgfritt `label` (streng).

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

Setter `queued`/`running` med **`updated_at`** eldre enn N minutter til `failed` / `error=tidsavbrudd` (ikke `created_at` — heartbeats via upsert teller). Standard **N=30**; n8n heartbeat **minst hvert 20. minutt**.

- **n8n:** schedule expire hvert 10. minutt (service_role, `p_minutes: 30`).
- **fm-web:** kun ved `POST /api/admin/research/...` (før ny rad opprettes).

### Aktiv jobb per klynge+kind

Maks én `queued`/`running` per `(cluster_id, kind)` (partial unique index). fm-web returnerer **409** med eksisterende brief når en annen aktiv jobb finnes.

### Payload-grenser (n8n_upsert_research_brief)

- `summary`: maks 20 000 tegn
- `error`: maks 500 tegn (kjent kode eller fri tekst)
- `perspectives` / `sources` / `details`: maks 64 KB (`octet_length` på JSON)

## Migrasjon

`supabase/migrations/20261021130000_research_briefs.sql` — **manuell apply** på prod. Ingen embedding-kolonner i v1; hvis de legges til senere, bruk **bge-m3** og `vector(1024)`.
