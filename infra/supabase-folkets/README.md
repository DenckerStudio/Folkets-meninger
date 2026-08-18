# supabase-folkets on Coolify (heyklever)

Self-hosted Supabase for Folkets Stemme, managed in Coolify project **Folkets-meninger.no**.

| Item | Value |
|------|-------|
| Coolify service | `supabase-folkets` |
| Service UUID | `yfjwpr0riezmaxuekvradco4` |
| Public API | `https://supabase.heyklever.app` |
| Coolify dashboard | `https://coolify.heyklever.app` |
| Frontend site URL | `https://folketsstemme.no` |
| OAuth callback | `https://supabase.heyklever.app/auth/v1/callback` |

## Current status (via Coolify MCP)

- All core containers are **running:healthy** (Kong, Auth/GoTrue, DB, Storage, Realtime, Studio, etc.).
- **OAuth is not enabled yet** — the Coolify Supabase template ships Google/GitHub GoTrue env lines commented out in `supabase-auth`.
- Auth logs show **noop mail client** (SMTP not configured) and **no SMS provider** for phone OTP.
- Repo migrations are **not applied** to this instance until `HEYKLEVER_DATABASE_URL` is provided.

## OAuth2 extension (GoTrue external providers)

Coolify’s Supabase one-click template documents OAuth as an “extension”: uncomment the GoTrue external-provider env block in the **Service stack** compose for `supabase-auth`, then set env vars.

The repo automates this:

```bash
export COOLIFY_API_TOKEN=...          # deploy + env write scope
export GOOGLE_OAUTH_CLIENT_ID=...
export GOOGLE_OAUTH_CLIENT_SECRET=...
export GITHUB_OAUTH_CLIENT_ID=...
export GITHUB_OAUTH_CLIENT_SECRET=...

# optional — direct Postgres URL (pooler or supabase-db) for migrations:
export HEYKLEVER_DATABASE_URL=postgres://postgres:PASSWORD@HOST:5432/postgres

node scripts/setup-supabase-folkets-coolify.mjs
```

Dry run (prints planned changes only):

```bash
node scripts/setup-supabase-folkets-coolify.mjs --dry-run
```

### Provider console setup

**Google Cloud Console** → OAuth 2.0 Client (Web):

- Authorized redirect URI: `https://supabase.heyklever.app/auth/v1/callback`
- Authorized JavaScript origins: `https://folketsstemme.no`, `https://supabase.heyklever.app`

**GitHub** → Settings → Developer settings → OAuth App:

- Authorization callback URL: `https://supabase.heyklever.app/auth/v1/callback`

### Critical auth env vars

| Variable | Purpose |
|----------|---------|
| `GOTRUE_SITE_URL` | Frontend origin (`https://folketsstemme.no`) — **not** the Supabase API host |
| `ADDITIONAL_REDIRECT_URLS` | Allow-list for `/api/auth/callback` redirects (Vercel previews, localhost) |
| `GOTRUE_EXTERNAL_*` | Google/GitHub OAuth client credentials |
| `GOTRUE_MAILER_EXTERNAL_HOSTS` | Suppresses forwarded-host warnings from Traefik |

## Full Supabase setup checklist

1. **OAuth** — run `scripts/setup-supabase-folkets-coolify.mjs` (above).
2. **Migrations** — script applies `supabase/migrations/*.sql` when `HEYKLEVER_DATABASE_URL` is set; or paste SQL in Studio.
3. **Voting pepper** — script runs `vote_encryption_secret` seed SQL; verify in `private.app_settings`.
4. **SMTP** (recommended) — set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL` in Coolify env so email signup confirmation works (currently noop).
5. **App env** — point the Next.js app at heyklever:
   - `NEXT_PUBLIC_SUPABASE_URL=https://supabase.heyklever.app`
   - Copy anon/service keys from Coolify → supabase-folkets → Environment Variables
   - Update `.env.test` / Vercel via `npm run vercel:env:supabase`
6. **Verify** — log in at `/auth/login` with Google/GitHub; cast a vote on a sak page.

## Manual Coolify UI fallback

If the API script cannot patch compose:

1. Open **supabase-folkets** → **Service stack** → edit compose.
2. In `supabase-auth` → `environment`, uncomment:

```yaml
      - 'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=${GOTRUE_EXTERNAL_GITHUB_CLIENT_ID}'
      - 'GOTRUE_EXTERNAL_GITHUB_ENABLED=${GOTRUE_EXTERNAL_GITHUB_ENABLED}'
      - 'GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=${GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI}'
      - 'GOTRUE_EXTERNAL_GITHUB_SECRET=${GOTRUE_EXTERNAL_GITHUB_SECRET}'
      - 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID}'
      - 'GOTRUE_EXTERNAL_GOOGLE_ENABLED=${GOTRUE_EXTERNAL_GOOGLE_ENABLED}'
      - 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=${GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI}'
      - 'GOTRUE_EXTERNAL_GOOGLE_SECRET=${GOTRUE_EXTERNAL_GOOGLE_SECRET}'
```

3. Set env vars in **Environment Variables** (Developer view).
4. **Restart** the service.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| OAuth redirects to Supabase signup form | Set `GOTRUE_SITE_URL` to frontend domain, not API URL |
| `Email not confirmed` | Configure SMTP or set `ENABLE_EMAIL_AUTOCONFIRM=true` for dev only |
| `sms Provider could not be found` | Disable phone signup (`ENABLE_PHONE_SIGNUP=false`) or configure Twilio |
| REST 401 with anon key | Use keys from this instance’s Coolify env, not supabase.co |
| Migrations fail on extensions | Ensure `pgcrypto`, `vector` exist (standard Supabase Postgres image) |

See also `supabase/README.md` for schema/runbook details.
