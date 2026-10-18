# Security sweep (2026-10-18) — roadmap incident

## Root cause (roadmap graffiti)

1. **`lib/admin/app-future.ts` `updateAppRoadmapItem`** performed a **service-role direct `UPDATE` on `app_roadmap_items` with no `app_future_require_admin` check** in the database. API routes called `requireAdmin`, but any path that reached this helper with the service key (or a broken admin gate) could mutate the public veikart.
2. **`lib/admin/gate.ts` `isAdmin`** treated **`user.app_metadata.role === 'admin'`** as sufficient when `user_roles` had no row. Stale or incorrect JWT app metadata could grant admin API access without a row in `user_roles`.
3. **Defense in depth:** Prod may lag `20261018150000` lockdown; `20261020110000_roadmap_write_hardening.sql` re-applies revoke + adds `update_app_roadmap_item` RPC.

## Fixed in this PR (high)

| Item | Fix |
|------|-----|
| Roadmap writes | `update_app_roadmap_item` + extended `create_app_roadmap_item`; app uses RPCs only |
| Admin gate | `isAdmin` reads **`user_roles` only** |
| Security headers | HSTS, Referrer-Policy, Permissions-Policy, CSP (non-embed), X-Content-Type-Options |

## Remaining findings

### High (not fixed here — needs follow-up)

- **In-memory `checkRateLimit`**: not shared across serverless instances (weak abuse control globally).

### Medium

- **`/api/admin/me`**: exposes `admin: boolean` to any logged-in user (informational; acceptable but enumerable).
- **Changelog admin**: same service-role pattern as roadmap before patch; RPCs already call `app_future_require_admin` — verify no direct `.update()` on `app_changelog_entries` (none found).

### Low

- **CSP** allows `'unsafe-inline'` / `'unsafe-eval'` for Next.js compatibility — tighten with nonces later.
- **Embed routes** intentionally omit full CSP (frame-ancestors only).
