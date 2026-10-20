# n8n — aksjonsfangst (action capture)

Kontrakt mellom n8n-pipeline og Supabase `action_clusters` / `action_sources` (migrasjoner `20261019235000_action_capture_tables.sql`, `20261021100000_action_capture_rpcs.sql`, `20261021110000_action_capture_atomic.sql`). **Ikke auto-appliert på prod** — Coolify Expert kjører SQL manuelt etter godkjenning.

Admin-visning: `/dashboard/admin/research` (leser tabellene via `service_role` i fm-web).

## Autentisering

| Felt | Verdi |
|------|--------|
| Credential (navn i n8n) | **Folkets Stemme Self-hosted** (service role) |
| Header | `apikey: <SUPABASE_SERVICE_ROLE_KEY>` |
| Header | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Content-Type | `application/json` |

Ingen anon/authenticated: RPC-ene er kun `GRANT EXECUTE` til `service_role`.

## Rekkefølge i pipeline

1. **Innhenting** — RSS / Reddit / petition / SearXNG-noder produserer normaliserte kildeobjekter.
2. **Klynging + klassifisering** — LLM/regler setter `action_key`, `action_type`, `action_name`, `description_nb`, ev. `sensitive_category`, `best_scale`.
3. **`upsert_action_capture`** — skriv klynge + kilder (kan kjøres flere ganger per klynge når nye kilder dukker opp).
4. **`set_action_cluster_verdict`** (valgfritt) — etter klassifisering/terskel-steg: sett `status` + `verdict_reasons` uten å overskrive admin-låste rader.
5. **Senere** (utenfor denne migrasjonen) — system-poll / admin `publish_poll` kobler `poll_id` og setter `drafted` med `decided_by`.

## HTTP: `upsert_action_capture`

```http
POST {SUPABASE_URL}/rest/v1/rpc/upsert_action_capture
apikey: {service_role}
Authorization: Bearer {service_role}
Content-Type: application/json
```

Body (PostgREST):

```json
{
  "p_cluster": {
    "action_key": "opprop:gratis-skolemat-nasjonal:2026",
    "action_type": "opprop",
    "action_name": "Opprop for gratis skolemat nasjonalt",
    "description_nb": "Kort norsk beskrivelse av oppropet (vises internt / til videre behandling).",
    "topic": "skole",
    "target": "Regjeringen",
    "target_kind": "myndighet",
    "sensitive_category": null,
    "status": "candidate",
    "verdict_reasons": [],
    "independent_publishers": ["aftenposten.no", "nrk.no"],
    "national_coverage": true,
    "max_confidence": 0.82,
    "best_scale": {
      "value": 5400,
      "unit": "underskrifter",
      "source_url": "https://example.com/petition",
      "as_of": "2026-10-19"
    },
    "related_issue_id": null,
    "related_similarity": null,
    "metadata": {
      "pipeline_run_id": "n8n-run-uuid",
      "is_signal": false
    },
    "first_seen_at": "2026-10-17T08:00:00Z",
    "last_seen_at": "2026-10-19T14:30:00Z"
  },
  "p_sources": [
    {
      "item_key": "news_rss:https://www.nrk.no/nyheter/sak-123",
      "url_canonical": "https://www.nrk.no/nyheter/sak-123",
      "source_type": "news_rss",
      "publisher": "nrk.no",
      "signal_only": false,
      "title": "Tittel fra RSS",
      "excerpt": "Maks 300 tegn lagres; lengre tekst trimmes i DB.",
      "published_at": "2026-10-17T08:00:00Z",
      "fetched_at": "2026-10-19T14:30:00Z",
      "confidence": 0.75,
      "classification": { "model": "gemma4:26b", "label": "opprop" }
    }
  ]
}
```

### Suksess-respons

```json
{
  "ok": true,
  "cluster_id": "uuid",
  "inserted_sources": 1,
  "updated_sources": 0,
  "status": "candidate"
}
```

### Feil (validering)

Ved valideringsfeil kaster RPC-en `RAISE EXCEPTION` med SQLSTATE **`22023`** (`invalid_parameter_value`). PostgREST svarer med **HTTP 400** og JSON som inneholder `code`, `message` og `details` — **ikke** `{ "ok": false, ... }`. Hele transaksjonen rulles tilbake (ingen delvise rader i `action_clusters` / `action_sources`).

Meldingen starter med `action_capture <kode>:` (f.eks. `action_capture missing_item_key: kilde index 1 mangler item_key`). Kilder valideres **alle** før første skriv.

| Kode i melding | Betydning |
|----------------|-----------|
| `invalid_cluster` | `p_cluster` er ikke et JSON-objekt |
| `missing_action_key` | Mangler `action_key` |
| `invalid_sources` | `p_sources` er ikke en array |
| `invalid_action_type` | Ugyldig/mangler `action_type` (ny klynge) |
| `missing_action_name` | Ny klynge uten `action_name` |
| `missing_description_nb` | Ny klynge uten `description_nb` |
| `invalid_cluster_status` | `status` utenfor CHECK-listen |
| `missing_item_key` | Kilde uten `item_key` (inkl. array-index) |
| `missing_source_type` | Kilde uten `source_type` |
| `invalid_source_type` | `source_type` må være `news_rss`, `reddit`, `petition`, `searxng` |
| `missing_url_canonical` | Kilde uten URL |

## HTTP: `set_action_cluster_verdict` (valgfritt)

```http
POST {SUPABASE_URL}/rest/v1/rpc/set_action_cluster_verdict
```

```json
{
  "p_action_key": "opprop:gratis-skolemat-nasjonal:2026",
  "p_status": "below_threshold",
  "p_verdict_reasons": ["under_terskel", "for_fa_uavhengige_kilder"]
}
```

Suksess: `{ "ok": true, "cluster_id": "uuid", "status": "below_threshold" }`

Validerings- og forretningsfeil: samme som over — **HTTP 400**, SQLSTATE `22023`, melding `action_capture <kode>: ...` (ingen `ok: false`).

| Kode i melding | Betydning |
|----------------|-----------|
| `missing_action_key` | Tom `p_action_key` |
| `invalid_cluster_status` | Ugyldig `p_status` |
| `invalid_verdict_reasons` | Ikke array/objekt |
| `cluster_not_found` | Ukjent `action_key` |
| `status_locked` | `decided_by` satt eller status `drafted` / `rejected` |

## Nøkkelformat (stabil, normalisert)

### `action_key`

Én klynge per reell aksjon. Anbefalt:

```text
{action_type}:{slug}:{år}
```

- `action_type` — samme enum som DB (`boykott`, `opprop`, …).
- `slug` — lowercase, ASCII-ish, bindestrek mellom ord: normaliser tittel/mål (fjern diakritikk, `[^a-z0-9]+` → `-`, trim `-`).
- `år` — firesifret år for hendelsen eller første observasjon.

Eksempel: `demonstrasjon:klimapolitikk-stortinget:2026`

### `item_key`

Én rad per unik kilde uansett klynge. **Anbefalt format:**

```text
{source_type}:{stabil_id}
```

Eksempler: `reddit:t3_abc123`, `petition:change-12345`, `news_rss:guid-eller-hash`

**Fallback** (hvis `item_key` utelates i payload): RPC genererer

```text
{source_type}:url:{url_canonical_normalisert}
```

(`url_canonical` lowercaset, trailing `/` fjernet.) Oppgitt `item_key` må starte med `{source_type}:`.

- `url_canonical` — scheme + host + path, lowercase host, uten fragment der det er trygt.
- Samme artikkel skal beholde samme `item_key` over tid (upsert).

## Feltmapping fra workflow-kilder

| Kilde i n8n | `source_type` | `publisher` | `signal_only` | Typiske felt |
|-------------|---------------|-------------|---------------|--------------|
| Nyhets-RSS | `news_rss` | domene fra feed/link (`nrk.no`) | `false` når full artikkel; `true` for korte signaler | `title`, `excerpt`, `published_at`, `url_canonical` |
| Reddit | `reddit` | `reddit.com` eller subreddit-navn | ofte `true` for diskusjonstråd | `title`, `excerpt` = selftext snippet, permalink som URL |
| Petition / underskriftskampanje | `petition` | plattformdomene | `false` | `best_scale` på klynge fra signaturtall; `excerpt` fra kampanjebeskrivelse |
| SearXNG (oppdagelse) | `searxng` | treff-domene | vanligvis `true` inntil RSS bekrefter | `url_canonical` = endelig artikkel-URL, kort `excerpt` fra snippet |

Klyngefelter fra klassifisering:

| Workflow-felt (eksempel) | `p_cluster`-felt |
|--------------------------|------------------|
| type (boikott/opprop/…) | `action_type` |
| visningstittel | `action_name` |
| norsk sammendrag | `description_nb` |
| tema / mål | `topic`, `target`, `target_kind` |
| sensitiv kategori | `sensitive_category` |
| signaturer/medlemmer | `best_scale` jsonb |
| nasjonal dekning | `national_coverage` |
| første observasjon | `first_seen_at` (valgfri ISO-tid; backfill) |

Etter hver upsert beregner RPC **`independent_publishers`** og **`max_confidence`** på nytt fra `action_sources` for klyngen: distinkte `publisher` der `signal_only = false`, og `max(confidence)` over kilder. Verdier i `p_cluster` for disse feltene brukes ikke til å akkumulere.

### Signal (`signal_only`)

**Eneste kilde i admin/Oppfanget:** kolonnen `action_sources.signal_only`. RPC setter den til `true` hvis minst én av disse i kilde-JSON:

- `signal_only: true`
- `record_kind: "signal"`
- `metadata.is_signal: true` (eller toppnivå `is_signal: true` inntil n8n kun sender `metadata`)

Ved re-upsert uten signal-felt i payload beholdes eksisterende `signal_only`.

### Delvise oppdateringer / JSON `null`

- Felt som **mangler** i `p_cluster` / kilde-objekt, eller er eksplisitt JSON-`null`, **overskriver ikke** lagrede verdier på cluster- eller kilde-rad (f.eks. `best_scale: null` tømmer ikke gammel skala).
- Unntak: `signal_only` oppdateres bare når signal-indikatorer sendes (se over).

## Statusregler (viktig)

RPC **oppdaterer ikke** `status` / `verdict_reasons` på eksisterende klynge når:

- `decided_by IS NOT NULL`, eller
- `status IN ('drafted', 'rejected')`.

Andre felt (navn, beskrivelse, kilder, `first_seen_at` / `last_seen_at`, recalc fra kilder) oppdateres fortsatt.

### Dagstak (n8n klassifisering)

Når daglig kvote for auto-utkast er nådd, sett via `set_action_cluster_verdict` (eller cluster `status` i capture der ikke låst):

- `status`: `would_draft`
- `verdict_reasons`: må inneholde strengen **`dagstak`** (f.eks. `["dagstak"]`) slik at admin kan filtrere senere.

## Klyngesammenslåing (fremtid)

Se `docs/n8n/action-cluster-merge-proposal.md` — **ikke** implementert ennå.

## Signaturer (Postgres)

```sql
upsert_action_capture(p_cluster jsonb, p_sources jsonb DEFAULT '[]'::jsonb) RETURNS jsonb;
set_action_cluster_verdict(p_action_key text, p_status text, p_verdict_reasons jsonb DEFAULT '[]'::jsonb) RETURNS jsonb;
```

Begge: `SECURITY DEFINER`, `SET search_path = public, pg_temp`, kun `service_role`.
