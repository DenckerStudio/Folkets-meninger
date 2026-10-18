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
- Run migrations manually after deploy: `cd cms && npm run migrate` (requires approval; not part of `fm-web` deploy).

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
| `MEDIA_LOCAL_DIR` | Optional; persistent volume path for uploads |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | Optional Supabase Storage / S3-compatible media |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | One-off `npm run seed` only (never commit) |

Create CMS users:

- **admin** / **redaktør** — publish in admin UI
- **agent** — API key for n8n (draft only; access control enforced)
- **reader** — API key for `fm-web` read of published posts

## fm-web environment variables (blog)

| Variable | Purpose |
|----------|---------|
| `CMS_URL` | Internal or public CMS base URL |
| `CMS_API_KEY` | Payload user API key (`reader` role) |
| `CMS_AGENT_API_KEY` | Optional; n8n draft writes (else `CMS_API_KEY` if agent) |
| `REVALIDATE_SECRET` | Validates CMS → `/api/revalidate/blog` |
| `CRON_SECRET` | Existing; protects `/api/ops/blog/*` |

`BLOG_PUBLISHED_WEBHOOK_URL` is configured on **fm-cms**, not `fm-web`.

## Deploy steps (summary)

1. Add Coolify app `fm-cms` from repo, base directory `cms`, build Dockerfile, domain + TLS.
2. Mount volume for `MEDIA_LOCAL_DIR` (or configure S3).
3. Set env vars above; protect `/admin` with Cloudflare Access or IP allowlist.
4. Run `payload migrate` once against staging, then production (manual).
5. Run `npm run seed` once with `SEED_ADMIN_*` to create admin + default categories.
6. Create agent + reader users; store API keys in Coolify secrets for `fm-web` and n8n.
7. Set `fm-web` `CMS_URL` + keys; verify `/blogg` empty state, then publish a test post and confirm revalidation + webhook.

## Healthcheck

`GET /health` → `200 ok`
