# Security audit — 2026-10-19 (PR #172)

Branch: `cursor/security-roadmap-hardening-306f`. No production migrations applied from this agent run.

Companion: [SECURITY-SWEEP-2026-10-18.md](./SECURITY-SWEEP-2026-10-18.md) (roadmap incident root cause).

## Prod impersonation RPCs — app call-site matrix (grep 2026-10-19)

**n8n / automation:** `service_role` only (not listed below).

| RPC | Called from app? | Supabase client | Hotfix |
|-----|------------------|-----------------|--------|
| `cast_vote` | **No** (legacy; `POST /api/vote` → 410) | — | `REVOKE` → `service_role` only |
| `cast_poll_vote` | Yes — `lib/polls/service.ts` → `POST /api/polls` | **service_role** | `REVOKE` |
| `cast_app_suggestion_vote` | Yes — `lib/admin/suggestions.ts` → `POST /api/suggestions/vote` | **service_role** | `REVOKE` |
| `create_app_suggestion` | Yes — `app/api/suggestions/route.ts` (5-arg overload; old 2-arg dropped in migrations) | **service_role** | `REVOKE` (all overloads on prod) |
| `create_citizen_opinion` | Yes — `lib/opinions/service.ts` → `POST /api/opinions` | **service_role** | `REVOKE` |
| `create_citizen_opinion_reply` | Yes — `lib/opinions/service.ts` → `POST /api/opinions/[id]/stance` | **service_role** | `REVOKE` |
| `create_hearing_comment` | Yes — `app/api/hearings/route.ts` | **service_role** | `REVOKE` (both `(uuid,text,text)` and legacy `(uuid,uuid,text)` if present) |
| `get_user_poll_vote` | Yes — `lib/polls/service.ts` → `GET /api/polls` | **service_role** | `REVOKE` |
| `get_user_vote_on_issue` | Yes — `app/api/vote/route.ts` `GET` | **service_role** | `REVOKE` |
| `get_user_vote_history` | Yes — `app/api/user/vote-history/route.ts` | **service_role** | `REVOKE` |
| `set_issue_stance` | Yes — `lib/stances/service.ts` → `POST /api/stance` | **service_role** | `REVOKE` |
| `get_user_stance_on_issue` | Yes — `lib/stances/service.ts` → `GET /api/stance` | **service_role** | `REVOKE` |
| `get_user_stance_history` | Yes — `lib/stances/service.ts` → `GET /api/user/stance-history` | **service_role** | `REVOKE` |
| `get_user_stance_count` | Yes — `lib/stances/service.ts` (profile/knowledge paths) | **service_role** | `REVOKE` |
| `get_user_stance_signals` | Yes — `lib/stances/service.ts` → `GET /api/user/stance-signals` | **service_role** | `REVOKE` |
| `record_political_consent` | Yes — `lib/consent/service.ts` → `POST /api/user/political-consent` | **service_role** | `REVOKE` |
| `withdraw_political_consent` | Yes — `lib/consent/service.ts` | **service_role** | `REVOKE` |
| `withdraw_all_political_consents` | Yes — `lib/consent/service.ts` | **service_role** | `REVOKE` |
| `user_has_political_consent` | Yes — `lib/consent/service.ts` (`ensurePoliticalConsent`) | **service_role** | `REVOKE` |
| `report_content` | Yes — `app/api/opinions/report/route.ts` | **service_role** | `REVOKE` |
| `set_user_onboarding_state` | Yes — `app/api/user/onboarding/route.ts` | **service_role** | `REVOKE` |
| `update_user_profile_names` | Yes — `app/api/user/profile/route.ts`, `lib/ensure-public-user.ts` | **service_role** | `REVOKE` |
| `user_has_public_identity` | **No** direct `.rpc` in app TS (only inside other RPCs / RLS) | PostgREST-only risk if `EXECUTE` granted | `REVOKE` |
| `get_public_user_displays(uuid[])` | Yes — `lib/identity/public-user-display.ts` | **User session** SSR (`getServerSupabase`) on `app/dashboard/horinger/[id]/page.tsx`; same helper with session client in `lib/opinions/service.ts` for opinion detail | **Keep** `anon` + `authenticated` — returns only `first_name` / `last_name` / `name` for ids passing `user_has_public_display_eligibility` (`supabase/migrations/20261017120000_revoke_public_users_leak.sql`) |

**Fix files:** `supabase/hotfix/20261019_revoke_impersonation.sql` (apply on prod now); migration `20261020120001_revoke_impersonation_rpc_execute.sql`. Defense in depth: `20261020120000_rpc_caller_user_binding.sql` adds `assert_rpc_caller_is_user` inside function bodies when migrations ship.

No listed RPC is invoked via browser `createBrowserClient` `.rpc()` — only `get_public_user_displays` uses the logged-in (or anon) session client.

## Summary

| Severity | Fixed this PR | Open |
|----------|---------------|------|
| Critical | 3 | 0 |
| High | 8 | 1 |
| Medium | 9 | 2 |
| Low | 5 | 3 |

**Open high/critical:** none after H-1 (Postgres rate limits) and prod hotfix RPC revokes.

---

## 1. SECURITY DEFINER RPCs with `p_user_id` (authenticated EXECUTE)

Model: `assert_rpc_caller_is_user(p_user_id)` — when `auth.uid()` is present it must equal `p_user_id`; when null (`service_role` from app API) the server must pass the session user id. Helper is **service_role-only** (`supabase/migrations/20261020120000_rpc_caller_user_binding.sql`).

| Function | Action |
|----------|--------|
| `cast_vote` | Added `PERFORM assert_rpc_caller_is_user(p_user_id)` |
| `cast_poll_vote` | Added assert |
| `get_user_poll_vote` | Added assert |
| `set_issue_stance` | Added assert |
| `create_citizen_opinion` | Added assert |
| `create_citizen_opinion_reply` | Added assert |
| `create_hearing_comment` | Added assert |
| `create_app_suggestion` | Added assert |
| `cast_app_suggestion_vote` | Added assert |
| `set_user_onboarding_state` | Added assert |
| `create_opinion_innspill` | Added assert |
| `endorse_opinion_innspill` | Added assert |
| `report_content` | Added assert on `p_reporter_user_id` |
| `record_political_consent` | Added assert |
| `withdraw_political_consent` | Added assert |
| `withdraw_all_political_consents` | Added assert |
| `purge_political_processing_data` | Added assert |
| `update_user_profile_names` | Added assert |
| `get_user_vote_on_issue` | Added assert |
| `get_user_vote_history` | Added assert |
| `get_user_stance_on_issue` | **Revoked** `EXECUTE` from `anon`/`authenticated`; **service_role only** |
| `get_user_stance_history` | **service_role only** |
| `get_user_stance_count` | **service_role only** |
| `get_user_stance_signals` | **service_role only** |
| `user_has_political_consent` | **service_role only** (reads via API after session auth) |

Admin / grantor RPCs (prior migration `20261020110001_session_actor_and_rbac_hardening.sql`): **service_role only**; `require_admin_user_id(p_admin_user_id)` or `p_granted_by` — not user-spoofable via PostgREST JWT.

| Function | Action |
|----------|--------|
| `grant_app_role` / `grant_app_role_by_email` | `require_admin_user_id(p_granted_by)`; service_role only |
| `revoke_app_role` / `revoke_app_role_by_email` | Admin actor required; service_role only |
| `grant_stemme_plus*` / `revoke_stemme_plus*` | Admin actor required; service_role only |
| `create_*_roadmap_item`, `update_app_roadmap_item`, `delete_app_roadmap_item`, `set_app_roadmap_item_status` | service_role + `require_admin_user_id` |
| `create_app_changelog_entry`, `delete_app_changelog_entry` | service_role + admin actor |
| `set_app_suggestion_status`, `set_app_suggestion_voting` | service_role + admin actor |
| `publish_poll`, `archive_poll` | service_role only |

Contract test: `lib/rpc-caller-bindings.test.ts`. CI allowlist: `supabase/tests/security-guard.sql` (stance/consent read RPCs removed from `allow_auth`).

---

## 2. API routes and server actions sweep

Legend: **Auth** = session required where needed; **Admin** = `requireAdmin()`; **IDOR** = server uses `user.id` not client-supplied user; **Zod/validate** = schema or dedicated validator; **RL** = rate limit.

### Writes / sensitive

| Route | Auth | Admin | IDOR | Validate | RL | Status |
|-------|------|-------|------|----------|-----|--------|
| `POST /api/vote` | — | — | — | — | middleware | **Fixed** — returns 410 (stance/polls replace per-sak ballot) |
| `GET /api/vote` | optional | — | uses `user.id` for receipt RPC | query `issueId` | — | **OK** |
| `POST /api/stance` | yes | — | `user.id` | body checks | middleware IP | **OK** |
| `POST /api/polls` | yes | — | `user.id` | choice enum | middleware IP POST | **OK** |
| `POST /api/opinions` | yes | — | `user.id` | `lib/opinions/validate` | IP + user | **OK** |
| `POST /api/opinions/[id]/stance` | yes | — | `user.id` | validate | IP + user | **OK** |
| `POST /api/opinions/.../innspill` | yes | — | author check | — | user | **OK** |
| `POST /api/opinions/.../endorse` | yes | — | `user.id` | — | user | **OK** |
| `POST /api/opinions/report` | yes | — | `user.id` as reporter | categories | IP | **OK** |
| `POST /api/suggestions` | yes | — | `user.id` | `lib/suggestions/validate` | user | **OK** |
| `POST /api/suggestions/vote` | yes | — | `user.id` | zod payload | user | **OK** |
| `POST /api/feedback` | optional | — | — | manual + honeypot | IP | **OK** |
| `POST /api/hearings` | yes | — | `user.id` | field trim | IP + user | **Fixed** — user RL added |
| `POST /api/chat` (+ subroutes) | Stemme+ gate | — | session | — | IP + user | **OK** |
| `POST /api/byok` | yes | — | owner | providers | middleware | **OK** |
| `POST /api/stemme-plus/checkout` | yes | — | `user.id` | — | middleware | **OK** |
| `PATCH /api/user/profile` | yes | — | `user.id` | field limits | IP + user | **Fixed** — M-1 |
| `POST /api/user/political-consent` | yes | — | `user.id` | purpose enums | IP + user | **Fixed** — M-1 |
| `POST /api/user/onboarding` | yes | — | `user.id` | patch schema | — | **OK** |
| `POST /api/auth/welcome-email` | yes | — | `user.id` | once via notifications | IP + user (strict) | **Fixed** — M-2 |
| `POST /api/politician/response` | yes | — | `user.id` | — | IP + user | **Fixed** — M-3 |
| `POST /api/notifications/*` | yes | — | RLS `user_id` | — | — | **OK** |
| `POST /api/sak/[id]/knowledge` | yes | — | `user.id` | quiz | middleware | **OK** |
| `POST /api/sak/[id]/impact` | varies | — | — | — | middleware | **OK** |

### Admin

| Route | Admin | Status |
|-------|-------|--------|
| `/api/admin/*` | `requireAdmin()` | **Fixed** — app passes session `userId` into service_role RPCs |
| `POST /api/sak/[id]/ai-summary` | admin for trigger | **OK** |

### Cron / ops

| Route | Protection | Status |
|-------|------------|--------|
| `/api/cron/*` | `verifyCronAuth` (`CRON_SECRET`) | **OK** |
| `/api/ops/n8n-notify` | `verifyCronAuth` | **OK** |
| `/api/ops/blog/*` | `verifyOpsSecret` | **OK** |
| `POST /api/webhooks/stripe` | Stripe signature | **OK** |

### Public reads (no auth by design)

`/api/sak/*`, `/api/horinger`, `/api/sporsmal`, `/api/public/vote-stats`, etc. — read-only Stortinget/cache data; **OK**.

### Signup

Supabase Auth client (`signUp` / OAuth) — no app `POST` signup route. Abuse partially mitigated by Supabase + email confirmation; **Open M-4** — no app-level signup RL (platform concern).

---

## 3. Prior critical/high fixes (same PR)

| ID | Sev | Finding | Status | File |
|----|-----|---------|--------|------|
| C-1 | Critical | Roadmap/changelog writes without DB admin gate / direct service UPDATE | **Fixed** | `20261020110000_roadmap_write_hardening.sql`, `lib/admin/app-future.ts` |
| C-2 | Critical | `grant_app_role` without grantor check (self-admin) | **Fixed** | `20261020110001_session_actor_and_rbac_hardening.sql` |
| C-3 | Critical | Admin RPCs trusted `p_admin_user_id` without session binding | **Fixed** | same + `lib/admin/gate.ts` (`isAdmin` → `user_roles` only) |
| H-2 | High | Spoofable `p_user_id` on vote/opinion/stance RPCs via PostgREST | **Fixed** | `20261020120000_rpc_caller_user_binding.sql` |
| H-3 | High | Stance/consent read RPCs callable as arbitrary user | **Fixed** | service_role-only reads in same migration |
| H-4 | High | `n8n_issues_missing_ai_summary` writable by authenticated | **Fixed** | `20261020110001_session_actor_and_rbac_hardening.sql` |
| H-5 | High | `user_roles` direct DML for anon/authenticated | **Fixed** | same |
| H-6 | High | Missing security headers on main app | **Fixed** | `next.config.ts` |
| H-7 | High | Hearing comments without dedicated RL | **Fixed** | `app/api/hearings/route.ts`, `lib/rate-limit.ts` |

---

## 4. HTTP security headers

| Header | Main app | Embed |
|--------|----------|-------|
| `Content-Security-Policy` | **Report-Only** (`Content-Security-Policy-Report-Only`) | Enforcing `frame-ancestors *` only |
| `X-Frame-Options` | `SAMEORIGIN` | — |
| `Strict-Transport-Security` | yes | yes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | yes |
| `Permissions-Policy` | camera/mic/geo/payment disabled | yes |
| `X-Content-Type-Options` | `nosniff` | yes |

File: `next.config.ts`.

---

## 5. Medium / low (open)

| ID | Sev | Finding | Status | File |
|----|-----|---------|--------|------|
| M-1 | Medium | Profile/consent POST without per-user RL (auth required) | **Fixed** | `app/api/user/profile/route.ts`, `political-consent/route.ts` |
| M-2 | Medium | Welcome email endpoint without RL | **Fixed** | `app/api/auth/welcome-email/route.ts` |
| M-3 | Medium | Politician response POST without RL | **Fixed** | `app/api/politician/response/route.ts` |
| M-4 | Medium | No app-level signup rate limit (Supabase Auth only) | Open | client auth |
| M-5 | Medium | `/api/admin/me` exposes `admin: boolean` to any logged-in user | Open | `app/api/admin/me/route.ts` |
| L-1 | Low | CSP allows `unsafe-inline` / `unsafe-eval` for Next.js | Open | `next.config.ts` |
| L-2 | Low | CSP not enforcing on main site (report-only rollout) | Open | `next.config.ts` |
| L-3 | Low | Embed routes omit full CSP by design | Accepted | `next.config.ts` |

---

## Verification

- `node scripts/check-migrations.mjs`
- `npm run test:unit` (includes `lib/rpc-caller-bindings.test.ts`, `lib/admin/security-rbac.test.ts`)
- `npm run lint` && `npm run build`
- CI: GitHub Actions on push (Supabase security-guard when configured)
