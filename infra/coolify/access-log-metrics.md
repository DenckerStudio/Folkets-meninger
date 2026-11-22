# Traefik access-log → HTTP-feilaggregater

Aggregerte HTTP-statuser (404, 5xx, …) for admin-fanen **Feil**, uten å lagre rå IP i app-databasen.

Data lander i Supabase-tabellen `public.analytics_http_daily` via RPC
`n8n_upsert_analytics_http_daily` (**service_role** only). Migrasjon:
`supabase/migrations/20261122130000_analytics_http_errors.sql` (manuell apply).

## Personvern

- Kun **aggregater**: `bucket_date`, `host`, `path_template`, `status_code`, `request_count`, `is_bot`.
- Rå Traefik-logger blir på **klever** med vanlig log-rotasjon — **ikke** kopier fulle access logs til Supabase.
- Offentlige sidevisningstall (Umami + `/api/analytics/collect`) er JS-baserte og bot-filtrerte; Traefik-tall inkluderer crawlere med mindre `is_bot=true` settes ved parsing.

## Hvor ligger logger?

Coolify Expert bekrefter på klever:

1. Traefik access log-format (JSON anbefales) og filsti / docker log driver.
2. At `fm-web` / `www.folkets-meninger.no` router logger `DownstreamStatus` (eller tilsvarende statusfelt).

## Pipeline (valg A — n8n, anbefalt først)

Planlagt n8n-flyt (ikke importer til prod uten eier-prosess):

1. **Schedule** (f.eks. hver time eller daglig etter midnatt).
2. **Les** gårsdagens / siste times loggfiler (SSH/Execute Command på klever, eller montert volume — avhengig av Coolify-oppsett).
3. **Code-node**: parse JSON/CLF → normaliser path (samme regler som `lib/analytics/path-template.ts`):
   - strip query/hash
   - UUID / lange tall → `:id`
   - bucket `/api/admin/*`, `/_next/*`, `/dashboard/admin/*`
4. Marker `is_bot` med samme UA-heuristikk som `lib/analytics/bot.ts` (eller konservativ substring-liste).
5. Grupper: `(bucket_date, host, path_template, status_code, is_bot)` → `request_count`.
6. **HTTP Request** `POST` PostgREST RPC `n8n_upsert_analytics_http_daily` med body:

```json
{
  "p_rows": [
    {
      "bucket_date": "2026-11-21",
      "host": "www.folkets-meninger.no",
      "path_template": "/blogg/:id",
      "status_code": 404,
      "request_count": 12,
      "is_bot": false,
      "source": "traefik"
    }
  ]
}
```

Credential: eksisterende Supabase API-credential (**Folkets Meninger Self-hosted**).

SDK-skisse i repo: [`workflows/n8n/analytics-http-daily.workflow.ts`](../../workflows/n8n/analytics-http-daily.workflow.ts) (må fylles med reell logg-lesing før publish).

## Pipeline (valg B — Vector)

Bruk bare hvis n8n blir skjør ved volum: Vector → batch HTTP mot samme RPC. Pin image; ingen offentlig port.

## Retention for rå logger

Hold Traefik access logs i f.eks. **7–30 dager** på disk (logrotate). Aggregater i `analytics_http_daily` kan beholdes lenger (dashboard); valgfritt purge eldre enn 90 dager via separat cron senere.

## Verifisering

1. Coolify Expert apply migrasjon `20261122130000`.
2. Kjør upsert manuelt med én testrad (service_role).
3. Admin → Statistikk → **Feil** viser topp 404 og statusklasser.
4. Sammenlign en kjent død URL mot Traefik 404-toppliste.

## Relatert

- Umami / førsteparts: [`umami.md`](umami.md)
- App `http_error`-events: `lib/analytics/collect-server.ts`, `lib/analytics/record-http-error.ts`
- Admin RPC: `admin_get_http_errors(uuid, int)`
