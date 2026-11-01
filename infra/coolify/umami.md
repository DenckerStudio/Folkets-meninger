# Self-hosted Umami på Coolify

Anonym besøksanalyse for **fm-web** (`www.folkets-meninger.no`). Scriptet lastes fra `app/layout.tsx` når analyse er skrudd på — offentlig blogg på `/blogg` følger samme sidevisninger uten eget script i Payload (`fm-cms`).

Drift på Coolify-server **`klever`**. Ikke Vercel.

## Tjeneste

| Felt | Verdi |
|------|--------|
| Coolify-app | Ny tjeneste fra Docker-image (ikke repo-build) |
| Image | `ghcr.io/umami-software/umami:postgresql-latest` |
| Offentlig vert | `https://analytics.folkets-meninger.no` |
| Intern port | Container **3000** (kun Traefik utad; **ingen** publisert host-port) |

## Postgres (egen database)

Umami skal ha **egen Postgres-database** på klever — **ikke** Supabase/`public`-databasen til appen og **ikke** Payload-schema `payload`.

- Opprett database + rolle med full tilgang kun til den databasen.
- Sett `DATABASE_URL` i Coolify (format `postgresql://…` — **verdi kun i Coolify**, aldri i repo eller PR).

## Miljøvariabler (kun navn)

| Variabel | Formål |
|----------|--------|
| `DATABASE_URL` | Postgres-URL til Umami-databasen |
| `APP_SECRET` | Session-/krypteringsnøkkel for Umami-admin (generer sterk tilfeldig streng) |
| `DISABLE_TELEMETRY` | Sett `1` — slå av Umami vendor telemetry |

Ingen andre hemmeligheter trengs for grunnoppsettet. Admin-passord settes i Umami UI ved første innlogging.

## Nett og Traefik

- Koble Coolify-domene **`analytics.folkets-meninger.no`** til tjenesten med TLS (Let's Encrypt / eksisterende mønster på klever).
- **Ikke** eksponer Umami-containerens port direkte på internett — kun via Traefik på det hostnavnet.
- Valgfritt: begrens `/` (admin) med Cloudflare Access eller IP-allowlist; **`/script.js`** må være tilgjengelig for `www.folkets-meninger.no` (CORS/script-tag).

## Umami: nettsted i UI

Etter deploy og første admin-bruker:

1. Logg inn på `https://analytics.folkets-meninger.no`.
2. Opprett **ett** nettsted for hoveddomenet, f.eks. navn «Folkets Meninger», domene **`folkets-meninger.no`** (inkluder **`www`** i domene-/URL-matching slik Umami versjonen støtter — én nettside-ID for hele fm-web inkl. `/blogg`).
3. Kopier **Website ID** (UUID) til Coolify på `fm-web`.

**Ikke** opprett separat nettsted for `cms.folkets-meninger.no` i denne fasen (produktvalg B2): redaktør-UI i Payload telles ikke som offentlig blogg-trafikk.

### Cookieless

Aktiver **cookieless tracking** i Umami hvis innstillingen finnes i den installerte versjonen (Settings / nettsted — bekreft i UI etter oppgradering). Da trenger fm-web **ingen** informasjonskapsel-banner for Umami.

## fm-web etter Umami er oppe

Sett i Coolify på **`fm-web`** (verdier uten hemmeligheter i repo):

| Variabel | Verdi / merknad |
|----------|------------------|
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `true` |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | `https://analytics.folkets-meninger.no/script.js` |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | UUID fra Umami (ett nettsted) |

Deploy `fm-web` på nytt. Lokalt forblir flagget av som standard (se `.env.example`).

**Verifisering:** åpne forsiden → nettverkfanen skal hente `script.js` fra analytics-host; Umami-dashboard viser sidevisninger innen kort tid.

## Førsteparts hendelser (app-databasen) — separat

Admin-statistikk for delingslenker, UTM og produktmetrikker ligger i **Supabase `public`**, ikke i Umami:

- Tabeller/RPC-er: migrasjoner `20261101120000_analytics_share_links.sql`, `20261101130000_create_share_link.sql`, `20261101140000_admin_analytics_overview.sql`.

**Disse migrasjonene kjøres ikke fra dette dokumentet.** Regler i repo:

- **Mathias** må si ja.
- **Coolify Expert** legger dem inn manuelt (som øvrige `supabase/migrations/`).

Umami-backup dekker **ikke** disse tabellene — de følger appens vanlige Supabase-backup.

## Backup

- Ta regelmessig **`pg_dump`** (eller tilsvarende) av **kun Umami-databasen** på klever.
- **Ikke** forveksle med dump av Supabase-produksjon / app-DB.
- Test restore i staging minst én gang.

## Drift

| Emne | Anbefaling |
|------|------------|
| Healthcheck | Coolify mot Umami `/api/heartbeat` eller `/` etter versjon |
| Oppgradering | Pin image-tag ved behov; test cookieless-innstilling på ny versjon |
| Telemetri | Hold `DISABLE_TELEMETRY=1` |
| Personvern | Oppdatert personvernerklæring på fm-web når analyse skrus på i prod |

## Relatert

- App: `lib/analytics/flags.ts`, `lib/analytics/umami-script.tsx`, `app/layout.tsx`
- CMS-hosting (uten Umami-script): `infra/coolify/cms.md`
- Historisk infra-plan: `infra/coolify/README.md`
