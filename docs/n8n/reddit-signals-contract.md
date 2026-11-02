# n8n — Reddit-signaler (Research)

Kontrakt mellom n8n-innhenting (Arctic Shift, read-only) og Supabase `public.reddit_signals` (migrasjon `20261102200000_reddit_signals.sql`). **Ikke auto-appliert på prod** — Coolify Expert kjører SQL manuelt etter godkjenning.

Admin-visning: `/dashboard/admin/research` (type «Reddit»), sortert sammen med «Melding» etter `last_seen_at`.

## Autentisering

| Felt | Verdi |
|------|--------|
| Credential (navn i n8n) | **Folkets Stemme Self-hosted** (service role) |
| Header | `apikey: <SUPABASE_SERVICE_ROLE_KEY>` |
| Header | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Content-Type | `application/json` |

Kun `service_role`: `REVOKE EXECUTE` fra `PUBLIC`, `anon`, `authenticated`.

## HTTP: `n8n_upsert_reddit_signals`

```http
POST {SUPABASE_URL}/rest/v1/rpc/n8n_upsert_reddit_signals
apikey: {service_role}
Authorization: Bearer {service_role}
Content-Type: application/json
```

Body (PostgREST):

```json
{
  "p_rows": [
    {
      "reddit_id": "abc123",
      "subreddit": "norge",
      "title": "Diskusjonstittel (trimmes til 300 tegn)",
      "score": 42,
      "num_comments": 17,
      "posted_at": "2026-11-02T10:00:00+00:00",
      "snapshot_at": "2026-11-02T12:00:00+00:00",
      "topic": "valgfritt",
      "related_issue_id": "12345",
      "related_similarity": 0.812
    }
  ]
}
```

### Regler

| Regel | Detalj |
|-------|--------|
| `p_rows` | JSON **array**, maks **100** elementer; ellers `{ "error": "…" }` |
| Tillatte felt per element | `reddit_id`, `subreddit`, `title`, `score`, `num_comments`, `posted_at`, `snapshot_at`, `topic`, `related_issue_id`, `related_similarity` |
| Ignoreres | Alle andre nøkler (`url`, `author`, `selftext`, `body`, …) — **lagres aldri** |
| `reddit_id` | `^[a-z0-9]{1,12}$` |
| `subreddit` | Nøyaktig `norge`, `norske` eller `Nordmenn` — **aldri slått sammen** |
| `url` | Bygges i DB: `https://www.reddit.com/comments/<reddit_id>/` |
| `related_issue_id` | Valgfri; må finnes i `stortinget_issues`, ellers settes `NULL` (rad avvises ikke) |
| `related_similarity` | Valgfri `numeric(4,3)`; ved upsert beholdes lagret verdi når innkommende er `NULL` |
| Batch-dedupe | Duplikat `reddit_id` i samme kall: **siste vinner** |
| Upsert | `ON CONFLICT (reddit_id)` oppdaterer score, tall, tider, tittel, topic; `last_seen_at = now()`; `first_seen_at` uendret |

### Suksess-respons

```json
{
  "inserted": 1,
  "updated": 0,
  "rejected": [{ "reddit_id": "bad!", "reason": "invalid reddit_id format" }]
}
```

### Feil (hele kallet)

```json
{ "error": "max 100 rows per batch" }
```

Ugyldige enkeltrader havner i `rejected`; øvrige rader committes.

## Personvern / signal-only

- Ingen forfatter, brukernavn, selftext eller kommentarinnhold lagres.
- Reddit er **interessesignal**; fakta krever uavhengige kilder.
