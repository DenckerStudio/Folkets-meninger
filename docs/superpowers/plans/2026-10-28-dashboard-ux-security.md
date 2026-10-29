# Dashboard UX and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed dashboard authorization, request-trust, keyboard-accessibility, and failure-state defects without redesigning the product.

**Architecture:** Keep authorization decisions server-side and fail closed when Supabase cannot verify a user. Centralize proxy-derived client IP handling, remove the dashboard's request-header-derived self-fetch, and improve shared UI primitives so fixes cover every dashboard consumer.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase SSR, Node `assert` tests, Playwright.

## Global Constraints

- All user-visible copy must be Norwegian bokmål.
- Do not add dependencies.
- Keep behavior unchanged outside the confirmed defects.
- Do not expose secrets or add database migrations.
- Imports stay at module scope.
- Use semantic theme tokens instead of hard-coded grays.
- Production is behind Coolify/Traefik: prefer `X-Real-Ip`; otherwise use the rightmost non-empty `X-Forwarded-For` hop.

---

### Task 1: Fail-closed dashboard authentication

**Files:**
- Modify: `lib/supabase-middleware.ts`
- Create: `lib/supabase-middleware.test.ts`

**Interfaces:**
- Consumes: `supabase.auth.getUser()`
- Produces: a verified `User | null`; verification errors and timeouts produce `null`, never a cookie-derived session user.

- [ ] **Step 1: Add a failing regression test**

Create fake auth clients for a verified user, a rejected `getUser()`, and a never-resolving `getUser()`. Assert that the first returns the user and the latter two return `null`. Also assert that `lib/supabase-middleware.ts` contains no authorization fallback to `auth.getSession()`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx lib/supabase-middleware.test.ts`

Expected: the rejection or timeout case exposes the current cookie-session fallback, or the source contract fails because `getSession()` is present in the authorization helper.

- [ ] **Step 3: Implement the minimal fail-closed helper**

Keep the existing 3.5-second bound. Race `auth.getUser()` against the timeout, return `result.data.user` only on success, and return `null` from the catch path. Clear the timeout in `finally`. Do not call `getSession()` from the authorization helper; retain `getSession()` only in `refreshSessionCookies()`, where no access decision is made.

- [ ] **Step 4: Verify the focused test**

Run: `npx tsx lib/supabase-middleware.test.ts`

Expected: PASS, including rejected and timed-out verification.

- [ ] **Step 5: Commit**

Commit message: `Fix dashboard auth timeout fallback`

### Task 2: Use trusted proxy addresses for rate limits

**Files:**
- Create: `lib/trusted-client-ip.ts`
- Create: `lib/trusted-client-ip.test.ts`
- Modify: `middleware.ts`
- Modify: `app/api/auth/welcome-email/route.ts`
- Modify: `app/api/byok/ollama/models/route.ts`
- Modify: `app/api/chat/rettskriving/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/chat/sak-context/route.ts`
- Modify: `app/api/chat/sources/route.ts`
- Modify: `app/api/chat/suggestions/route.ts`
- Modify: `app/api/feedback/route.ts`
- Modify: `app/api/opinions/[id]/stance/route.ts`
- Modify: `app/api/opinions/report/route.ts`
- Modify: `app/api/opinions/route.ts`
- Modify: `app/api/politician/response/route.ts`
- Modify: `app/api/user/political-consent/route.ts`
- Modify: `app/api/user/profile/route.ts`

**Interfaces:**
- Produces: `trustedClientIp(request: Pick<Request, 'headers'>): string`
- Policy: trimmed `x-real-ip`, else the rightmost non-empty `x-forwarded-for` hop, else `"unknown"`.

- [ ] **Step 1: Add failing helper tests**

Cover `X-Real-Ip` precedence, rightmost forwarded hop selection, blank hops, and missing headers. Include a spoofed leftmost value and assert it is not selected.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx lib/trusted-client-ip.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement and adopt the helper**

Implement the four-line policy above. Replace every duplicated leftmost-hop parser under `app/api/` and in `middleware.ts` with the shared helper. Keep existing rate-limit keys and limits unchanged.

- [ ] **Step 4: Verify helper and stale-parser removal**

Run: `npx tsx lib/trusted-client-ip.test.ts`

Run: `rg "split\\(','\\)\\[0\\]" middleware.ts app/api`

Expected: test PASS; search returns no matches.

- [ ] **Step 5: Commit**

Commit message: `Trust proxy client IPs for rate limits`

### Task 3: Remove request-header-derived dashboard self-fetch

**Files:**
- Modify: `app/dashboard/representanter/page.tsx`
- Create: `lib/dashboard/representanter-page.test.ts`

**Interfaces:**
- Consumes: `getRepresentanterForPeriode(STORTINGET_ACTIVE_PERIODE_ID)`
- Produces: the same representative list UI without constructing an origin from request headers.

- [ ] **Step 1: Add a failing source contract**

Assert that the page imports and calls `getRepresentanterForPeriode`, does not import `headers`, and contains no `x-forwarded-host`, `x-forwarded-proto`, or `/api/representanter` self-fetch.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx lib/dashboard/representanter-page.test.ts`

Expected: FAIL on the current `headers()`-derived fetch.

- [ ] **Step 3: Call the service directly**

Remove request-header origin construction and call `getRepresentanterForPeriode()` directly. Preserve the existing error empty state by catching service failure and using an empty list with the active period.

- [ ] **Step 4: Verify the focused test**

Run: `npx tsx lib/dashboard/representanter-page.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `Remove representative page self-fetch`

### Task 4: Make shared dialogs keyboard-modal

**Files:**
- Modify: `components/ui/dialog.tsx`
- Create: `lib/dashboard/dialog-accessibility.test.ts`

**Interfaces:**
- Dialog focus enters the modal on open, wraps between its first and last focusable controls on `Tab`/`Shift+Tab`, and returns to the previously focused element on close.

- [ ] **Step 1: Add a failing accessibility contract**

Assert the shared dialog records `document.activeElement`, focuses inside `dialogRef`, handles `Tab` in both directions, and restores focus during effect cleanup. Keep the existing Escape behavior.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx lib/dashboard/dialog-accessibility.test.ts`

Expected: FAIL because focus entry, trapping, and restoration are absent.

- [ ] **Step 3: Implement focus management**

In the open-state effect, record the prior focused element. Focus the first enabled interactive element, falling back to the dialog container with `tabIndex={-1}`. On `Tab`, recompute visible enabled focusable elements and wrap at both ends. On cleanup, restore focus when the prior element is still connected. Preserve Escape and body scroll locking.

- [ ] **Step 4: Verify focused and existing dialog tests**

Run: `npx tsx lib/dashboard/dialog-accessibility.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `Make dashboard dialogs keyboard accessible`

### Task 5: Recover hearing submission and correct sort semantics

**Files:**
- Modify: `app/dashboard/horinger/[id]/comment-form.tsx`
- Modify: `app/dashboard/utforsk/explore-client.tsx`
- Create: `lib/dashboard/interaction-resilience.test.ts`

**Interfaces:**
- A rejected hearing submission re-enables the submit button and shows a Norwegian retry message.
- Utforsk sort controls are pressed buttons, not tabs without tab panels.

- [ ] **Step 1: Add a failing interaction contract**

Assert the comment form catches rejected `fetch()` calls and resets `submitting` in `finally`. Assert the sort container has an ordinary group label, sort buttons expose `aria-pressed`, and no sort button uses `role="tab"`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx lib/dashboard/interaction-resilience.test.ts`

Expected: FAIL for both missing network cleanup and incorrect tab semantics.

- [ ] **Step 3: Implement minimal fixes**

Wrap submission in `try/catch/finally`; retain existing non-2xx handling and use `Kunne ikke publisere innspillet. Prøv igjen.` for network failures. Change the sort wrapper to `role="group"` and each option to an ordinary button with `aria-pressed={selected}`.

- [ ] **Step 4: Verify the focused test**

Run: `npx tsx lib/dashboard/interaction-resilience.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `Improve dashboard interaction resilience`

### Final verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test:unit`.
- [ ] Run focused Playwright dashboard smoke tests.
- [ ] Manually verify desktop and mobile dashboard navigation, dialog keyboard behavior, and unauthenticated redirects.
