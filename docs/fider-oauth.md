# Fider SSO (feature requests)

Folkets Stemme uses a small OAuth 2.0 bridge in the Next.js app so users who are already
signed in via Supabase Auth can open Fider without a second login.

**Fider instance:** https://feedback.folkets-meninger.no (Coolify, `FIDER_BASE_URL`)

Supabase OAuth 2.1 server (`auth.oauth_server` in `supabase/config.toml`) is **disabled** on
heyklever, so this bridge is the supported integration path.

## Architecture

```text
User (logged in) → /dashboard/forslag → https://feedback.folkets-meninger.no/oauth/folkets
Fider → GET /api/oauth/fider/authorize → Supabase session → auth code
Fider → POST /api/oauth/fider/token → access token
Fider → GET /api/oauth/fider/userinfo → { sub, name, email }
```

## App environment

| Variable | Value / purpose |
|----------|-----------------|
| `FIDER_BASE_URL` | `https://feedback.folkets-meninger.no` (default in code if unset) |
| `FIDER_OAUTH_CLIENT_ID` | OAuth client id (shared with Fider admin) |
| `FIDER_OAUTH_CLIENT_SECRET` | OAuth client secret (shared with Fider admin) |
| `FIDER_OAUTH_PROVIDER_SLUG` | Optional; default `folkets` |
| `NEXT_PUBLIC_SITE_URL` | Canonical app URL for OAuth endpoints in Fider admin (prod: `https://folketsstemme.no`) |

Generate a strong client secret (32+ random bytes). The same id/secret must be entered in
Fider and in the app env.

## Fider admin (Coolify)

Fider runs at **https://feedback.folkets-meninger.no**. Ensure the Fider container `BASE_URL`
is `https://feedback.folkets-meninger.no` (include `https://`).

1. Log in to Fider as site admin → **Site Settings → Authentication → Add New**.
2. Use these values (replace `FIDER_OAUTH_*` with the secrets you generated):

| Fider field | Value |
|-------------|-------|
| Provider slug | `folkets` |
| Display name | `Folkets Stemme` |
| Client ID | value of `FIDER_OAUTH_CLIENT_ID` |
| Client secret | value of `FIDER_OAUTH_CLIENT_SECRET` |
| Authorize URL | `https://folketsstemme.no/api/oauth/fider/authorize` |
| Token URL | `https://folketsstemme.no/api/oauth/fider/token` |
| Profile API URL | `https://folketsstemme.no/api/oauth/fider/userinfo` |
| Scope | `openid profile email` (or leave empty) |
| JSON path ID | `sub` |
| JSON path Name | `name` |
| JSON path Email | `email` |

3. After saving, Fider shows the **callback URL**. It must be:

```text
https://feedback.folkets-meninger.no/oauth/folkets/callback
```

4. Use **Test** in Fider admin while the provider is still disabled.
5. Enable the provider when the test report is green.

## UX

- Dashboard nav: **Forslag** → `/dashboard/forslag` → redirect to
  `https://feedback.folkets-meninger.no/oauth/folkets` (not iframe).
- Users without a Supabase session are sent to `/auth/login` and return to the OAuth authorize
  step automatically.

## Security notes

- `redirect_uri` is restricted to `https://feedback.folkets-meninger.no/oauth/folkets/callback`.
- Authorization codes and access tokens are HMAC-signed, short-lived tokens (no DB table).
- Userinfo uses the Supabase service role to resolve the auth user by id.
