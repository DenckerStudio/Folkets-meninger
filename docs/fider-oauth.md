# Fider SSO (feature requests)

Folkets Stemme uses a small OAuth 2.0 bridge in the Next.js app so users who are already
signed in via Supabase Auth can open Fider without a second login.

Supabase OAuth 2.1 server (`auth.oauth_server` in `supabase/config.toml`) is **disabled** on
heyklever, so this bridge is the supported integration path.

## Architecture

```text
User (logged in) → /dashboard/forslag → Fider /oauth/folkets
Fider → GET /api/oauth/fider/authorize → Supabase session → auth code
Fider → POST /api/oauth/fider/token → access token
Fider → GET /api/oauth/fider/userinfo → { sub, name, email }
```

## App environment

| Variable | Purpose |
|----------|---------|
| `FIDER_BASE_URL` | Public Fider URL, e.g. `https://forslag.folketsstemme.no` |
| `FIDER_OAUTH_CLIENT_ID` | OAuth client id (shared with Fider admin) |
| `FIDER_OAUTH_CLIENT_SECRET` | OAuth client secret (shared with Fider admin) |
| `FIDER_OAUTH_PROVIDER_SLUG` | Optional; default `folkets` |
| `NEXT_PUBLIC_SITE_URL` | Canonical app URL for OAuth endpoints in Fider admin |

Generate a strong client secret (32+ random bytes). The same id/secret must be entered in
Fider and in the app env.

## Fider admin (Coolify)

Once `FIDER_BASE_URL` is live with HTTPS:

1. Log in to Fider as site admin → **Site Settings → Authentication → Add New**.
2. Use these values:

| Fider field | Value |
|-------------|-------|
| Provider slug | `folkets` (or `FIDER_OAUTH_PROVIDER_SLUG`) |
| Display name | `Folkets Stemme` |
| Client ID | `FIDER_OAUTH_CLIENT_ID` |
| Client secret | `FIDER_OAUTH_CLIENT_SECRET` |
| Authorize URL | `{NEXT_PUBLIC_SITE_URL}/api/oauth/fider/authorize` |
| Token URL | `{NEXT_PUBLIC_SITE_URL}/api/oauth/fider/token` |
| Profile API URL | `{NEXT_PUBLIC_SITE_URL}/api/oauth/fider/userinfo` |
| Scope | `openid profile email` (or leave empty) |
| JSON path ID | `sub` |
| JSON path Name | `name` |
| JSON path Email | `email` |

3. Copy the **callback URL** Fider shows after saving. It must be:

```text
{FIDER_BASE_URL}/oauth/{provider}/callback
```

Example: `https://forslag.folketsstemme.no/oauth/folkets/callback`

4. Use **Test** in Fider admin while the provider is still disabled.
5. Enable the provider when the test report is green.

### Fider container env

Ensure Fider `BASE_URL` includes the `https://` scheme (required for OAuth callbacks).

## UX

- Dashboard nav: **Forslag** → `/dashboard/forslag` → redirect to Fider SSO (not iframe).
- Users without a Supabase session are sent to `/auth/login` and return to the OAuth authorize
  step automatically.

## Security notes

- `redirect_uri` is restricted to `{FIDER_BASE_URL}/oauth/{slug}/callback`.
- Authorization codes and access tokens are HMAC-signed, short-lived tokens (no DB table).
- Userinfo uses the Supabase service role to resolve the auth user by id.
