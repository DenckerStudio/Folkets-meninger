# Security sweep (2026-10-18) — roadmap incident

## Root cause (roadmap graffiti + self-admin)

1. **`lib/admin/app-future.ts` `updateAppRoadmapItem`** performed a **service-role direct `UPDATE` on `app_roadmap_items` with no `app_future_require_admin` check** in the database. API routes called `requireAdmin`, but any path that reached this helper with the service key (or a broken admin gate) could mutate the public veikart.
2. **`lib/admin/gate.ts` `isAdmin`** treated **`user.app_metadata.role === 'admin'`** as sufficient when `user_roles` had no row. Stale or incorrect JWT app metadata could grant admin API access without a row in `user_roles`.
3. **Spoofable actor UUID:** Roadmap/changelog/suggestion admin RPCs were **`SECURITY DEFINER` + `service_role`**, checking admin only via **`p_admin_user_id` in `user_roles`** without tying the caller to that id. A non-admin could pass their own UUID only if the app gate was wrong; **`grant_app_role` had no grantor check at all** (self-promotion). `20261020110001_session_actor_and_rbac_hardening.sql` adds **`require_admin_user_id(p_actor)`** (must be a real admin row), keeps RPCs **`service_role`-only**, and routes pass **`auth.userId` after `requireAdmin()`**.
4. **Self-promotion:** `grant_app_role*` now requires **`p_granted_by`** and **`require_admin_user_id(p_granted_by)`** (bootstrap-only when zero admins). Same pattern for **`revoke_app_role*`** and **Stemme+ grant/revoke**.
5. **Defense in depth:** Prod may lag `20261018150000` lockdown; `20261020110000` + `20261020110001` re-apply revokes, session-bound RPCs, and **`REVOKE INSERT/UPDATE/DELETE/TRUNCATE` on `n8n_issues_missing_ai_summary`** for anon/authenticated.

## Fixed in this PR (high)

| Item | Fix |
|------|-----|
| Roadmap writes | `update_app_roadmap_item` + extended `create_app_roadmap_item`; app uses RPCs only |
| Admin gate | `isAdmin` reads **`user_roles` only** |
| Security headers | HSTS, Referrer-Policy, Permissions-Policy, CSP (non-embed), X-Content-Type-Options |

## Follow-up audit (2026-10-19)

Full inventory (RPC `p_user_id` binding, API sweep, headers, severities): **[SECURITY-AUDIT-2026-10-19.md](./SECURITY-AUDIT-2026-10-19.md)**.

## Remaining findings

### High (not fixed here — needs follow-up)

- **In-memory `checkRateLimit`**: not shared across serverless instances (weak abuse control globally). See **H-1** in the 2026-10-19 audit.

### Medium

- **`/api/admin/me`**: exposes `admin: boolean` to any logged-in user (informational; acceptable but enumerable).
- **Changelog admin**: same service-role pattern as roadmap before patch; RPCs already call `app_future_require_admin` — verify no direct `.update()` on `app_changelog_entries` (none found).

### Low

- **CSP** allows `'unsafe-inline'` / `'unsafe-eval'` for Next.js compatibility — tighten with nonces later.
- **Embed routes** intentionally omit full CSP (frame-ancestors only).
