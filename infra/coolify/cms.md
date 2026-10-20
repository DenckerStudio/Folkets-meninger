# Payload CMS (`fm-cms`) on Coolify

Blog content is edited in **Payload CMS 3** (`cms/`), deployed as a separate Coolify application. The public site (`fm-web`) reads published posts over REST with ISR and on-demand revalidation.

## Services

| App | Base directory | Domain | Notes |
|-----|----------------|--------|--------|
| `fm-web` | `/` (repo root) | `www.folkets-meninger.no` | Existing Next.js app |
| `fm-cms` | `/cms` | `cms.folkets-meninger.no` | Dockerfile in `cms/Dockerfile`, port **3001** |

## Postgres

- Use the **same** hosted Postgres as Supabase/Coolify DB.
- Payload uses schema **`payload`** (`PAYLOAD_SCHEMA=payload` optional).
- Create role `payload_app` with privileges **only** on schema `payload` (no `public` access).
- **Migrations:** `prodMigrations` in `payload.config.ts` runs pending SQL when Payload first connects in **production** (`NODE_ENV=production`), triggered on server boot via `instrumentation.ts` → `ensurePayloadReady()`. No separate manual migrate step on deploy unless you are fixing a failed migration. `disableCreateDatabase: true` — the shared Postgres already exists (Supabase/Coolify). The runtime Docker image has no Payload CLI, `tsx`, or `src/` — do not rely on `npm run migrate` in prod.
- **Login rate limit IP:** `POST /api/users/login` uses `X-Real-Ip` when set by Traefik; otherwise the **rightmost** hop in `X-Forwarded-For` (not the client-spoofable leftmost value).
- **Boot warmup:** `cms/src/instrumentation.ts` calls `ensurePayloadReady()` on Node server start so migrations and `SEED_ON_BOOT` run **before** traffic, even though `GET /health` stays a cheap liveness probe without touching Payload.
- Local/dev: `cd cms && npm run migrate` when schema changes.

`supabase/migrations/20261018120000_blog_posts.sql` is **superseded** and must not be applied.

## fm-cms environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URI` | Postgres URL (include `?search_path=payload` if needed) |
| `PAYLOAD_SECRET` | Payload encryption/session secret |
| `SERVER_URL` | Public CMS origin, e.g. `https://cms.folkets-meninger.no` |
| `PAYLOAD_SCHEMA` | `payload` (default) |
| `WEB_PUBLIC_URL` | `https://www.folkets-meninger.no` (for publish webhook URLs) |
| `WEB_REVALIDATE_URL` | `https://www.folkets-meninger.no/api/revalidate/blog` |
| `REVALIDATE_SECRET` | Shared HMAC secret with `fm-web` |
| `BLOG_PUBLISHED_WEBHOOK_URL` | n8n inbound webhook on publish |
| `BLOG_WEBHOOK_SIGNING_SECRET` | HMAC secret for publish webhook |
| `BLOG_OPS_SIGNING_SECRET` | Leave **empty** in Coolify — falls back to `REVALIDATE_SECRET` for `/api/blog-ops/social-posted` |
| `MEDIA_LOCAL_DIR` | Optional; persistent volume path for uploads |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | Optional Supabase Storage / S3-compatible media |
| `SEED_ON_BOOT` | Set `true` on first deploy to create admin + default taxonomy when no admin exists |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Used by `SEED_ON_BOOT` or one-off `npm run seed` (never commit) |

Create CMS users:

- **admin** / **redaktør** — publish in admin UI
- **agent** — API key for n8n (draft only; access control enforced)
- **reader** — API key for `fm-web` read of **published** posts only (cannot create, publish, or delete)

## fm-web environment variables (blog)

| Variable | Purpose |
|----------|---------|
| `CMS_URL` | Internal or public CMS base URL |
| `CMS_API_KEY` | Payload user API key (`reader` role) |
| `CMS_AGENT_API_KEY` | Optional; n8n draft writes |
| `REVALIDATE_SECRET` | Validates CMS → `/api/revalidate/blog` |
| `CRON_SECRET` | Existing; protects `/api/ops/blog/*` |

`BLOG_PUBLISHED_WEBHOOK_URL` is configured on **fm-cms**, not `fm-web`.

## Deploy steps (summary)

1. Add Coolify app `fm-cms` from repo, base directory `cms`, build Dockerfile, domain + TLS.
2. Mount volume for `MEDIA_LOCAL_DIR` (or configure S3).
3. Set env vars above; protect `/admin` with Cloudflare Access or IP allowlist.
4. First boot: set `SEED_ON_BOOT=true` + `SEED_ADMIN_*` once; migrations run automatically on container start.
5. Create agent + reader users; store API keys in Coolify secrets for `fm-web` and n8n.
6. Set `fm-web` `CMS_URL` + keys; verify `/blogg` empty state, then publish a test post and confirm revalidation + webhook.
7. Turn off `SEED_ON_BOOT` after admin exists.

## Healthcheck

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness only → `200 ok` (no DB/Payload; safe for frequent probes) |
| Server boot | `instrumentation.ts` → `ensurePayloadReady()` runs migrations + optional `SEED_ON_BOOT` |

Coolify can keep probing `/health`; schema/seed readiness is handled at process start, not on every health ping.

## Blog ops API (fm-web / n8n)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/blog-ops/lookup` | Agent API key | Idempotency: slug / `sourceEvent`, all statuses, no cache |
| `POST /api/blog-ops/social-posted` | HMAC (`x-fm-timestamp`, `x-fm-signature`; secret = `REVALIDATE_SECRET` if `BLOG_OPS_SIGNING_SECRET` unset) | Set `socialPostedAt` + `blueskyUri` on **published** posts only |
