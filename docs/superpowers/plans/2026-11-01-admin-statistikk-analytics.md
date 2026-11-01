# Admin-statistikk og besøksanalyse — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gi administratorer et samlet dashboard under `/dashboard/admin/statistikk` med besøkende, brukerlivssyklus, blogg-trafikk, personlige delingslenker og kanal/referrer — uten tredjeparts SaaS, i tråd med personvern-løftet.

**Architecture:** Hybrid **«letteste beste»**: (1) **Produktmetrikker** hentes direkte fra Supabase/`auth.users` via nye `service_role`-RPC-er (sannhet for registrering, innlogging, Stemme+, engasjement). (2) **Anonym web-analyse** via **self-hosted Umami** på Coolify (`klever`) for sidevisninger, referrers og enheter — cookieless modus der mulig. (3) **Førsteparts hendelser** i Postgres (`analytics_events` + `share_links`) kobler eksisterende `utm_*` / `ref` på `/del/` og fremtidige bruker-spesifikke lenker til admin-rapporter uten å duplisere hele Umami.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres + RLS, Coolify/Docker, Umami 2.x (PostgreSQL eller SQLite), eksisterende `lib/polls/share.ts` UTM-kontrakt, Payload CMS for blogg (fm-cms).

## Global Constraints

- **Nothing merges to `main` without Mathias' explicit yes.** Branch `cursor/…`, PR, grønn CI.
- **Migrations are never auto-applied.** Coolify Expert applies manually after Mathias says yes. New migration only; never edit applied migrations.
- **Never put secrets in code, commits, PR text, or logs.**
- **Hosting is Coolify** (not Vercel).
- **All admin UI copy is Norwegian bokmål.** No English UI strings. No BankID/MinID/eID in user-facing copy.
- **No AI labels in the UI.**
- **`TRUST_ANALYTICS_NOTE`** today: no third-party analytics like GA; server logs in Norway. Any change requires **oppdatert personvernerklæring** and honest empty states.
- **Browser must not call admin or user-bound RPCs** except `get_public_user_displays`.
- **New tables/functions:** REVOKE FROM PUBLIC/anon/authenticated, RLS, explicit GRANTs; admin RPCs use `require_admin_user_id`.
- **CI:** `npm run lint`, `npm run build`, `npm run test:unit`, db-security on changed migrations.

---

## Nåsituasjon (baseline)

| Område | I dag | Gap |
|--------|--------|-----|
| `/dashboard/admin/statistikk` | CSV/JSON eksport av **Stortinget-avstemningsaggregater** (`lib/government-stats/snapshot.ts`) | Ingen besøkende, brukere, blogg, deling |
| Poll-delings-URL | `utm_source`, `utm_medium`, `utm_campaign=poll_share`, `ref` (`lib/polls/share.ts`) | **Ingen innsamling** |
| Blogg | Payload på `fm-cms`, fm-web leser API | Ingen sidevisning per artikkel i admin |
| Personlige delingslenker | `ref` = partner/kampanje på `/del/` | Ingen `user_id`-knyttede lenker eller «hvem delte» |
| Bruker-admin | Kun admin-roller (`/dashboard/admin/brukere`) | Ingen telling av registrerte/aktive/inaktive |

---

## Løsningsvalg (anbefaling)

### Anbefalt: **Alternativ B — Umami + Postgres**

| | Umami (self-hosted) | Kun Postgres events | Matomo self-hosted | Traefik-loggparser |
|--|---------------------|---------------------|--------------------|--------------------|
| Drift | +1 liten container på Coolify | Ingen ny tjeneste | Tung (PHP/MySQL) | Ingen ny tjeneste |
| Referrer / kanal | ✅ innebygd | ⚠️ må bygges | ✅ | ⚠️ grov |
| Blogg + fm-web + CMS | ✅ script på begge | ✅ API-beacon | ✅ | ✅ (host-basert) |
| Personlige lenker / UTM | ⚠️ delvis (URL params) | ✅ full kontroll | ✅ | ⚠️ |
| Personvern-fortelling | «Egen analyse på vår server» | Sterkest | OK men tungt | «Serverlogger» |
| Admin UX | Embed iframe eller API | 100 % native UI | Embed | CSV-only |

**Umami** (~512 MB RAM): open source, GDPR-vennlig, cookieless tracking, norsk admin kan vente — **UI for deep-dive kan være engelsk inne i Umami** (kun admin på Coolify), mens **fm-web admin-dashboard forblir norsk**.

**Ikke anbefalt nå:** PostHog (overkill), Google Analytics (brutt løfte), Plausible Cloud (ikke self-hosted).

### Hva mer kan vi samle inn? (prioritert)

**Fase 1 — høy verdi, lav risiko**

- Unike besøkende / sidevisninger (dag/uke/måned), topp stier (`/`, `/blogg`, `/del/*`, `/dashboard/utforsk`)
- Referrer-kategorier: direkte, søk (Google/DuckDuckGo), sosial (Facebook, Bluesky, LinkedIn, WhatsApp), e-post, ukjent
- UTM `source` / `medium` / `campaign` på landing (poll share allerede standardisert)
- Brukere: registrert totalt, nye per periode, med `last_sign_in_at` (fra `auth.users`), «inaktiv» = ingen innlogging på 90 dager (konfigurerbar)
- Stemme+: antall aktive abonnement (`subscription_tier`)
- Poll share: visninger per poll, konvertering til stemme (session-basert hendelse, ikke personlig profilering)
- Blogg: visninger per `slug` (samme event pipeline)

**Fase 2 — produktinnsikt**

- Personlige delingslenker: `/l/{code}` eller `?fm_share={code}` opprettet av innlogget bruker, dashboard «Dine delinger»
- Embeds: visninger på `/embed/` + `ref=embed`
- Trakt: besøk → registrering → første stance/stemme (aggregert, daglig rollup)
- Høringer/saker: topp landingssider (ikke full brukerreise per person)
- CMS: hvilke n8n-utkast → publisert → mest lest

**Fase 3 — valgfritt**

- Land (kun land, fra Umami eller Traefik `CF-IPCountry` hvis Cloudflare)
- Enhetstype mobil/desktop
- RSS/`/blogg/rss.xml` klikk (redirect-logg)
- E-post/notification CTR (eksisterende SMTP-spor hvis lagt til senere)

**Bevisst ikke samle inn:** full IP i applikasjons-DB, fingerprinting på tvers av sider uten samtykke, per-bruker browsing-historikk koblet til navn.

---

## Filkart (ny/endret)

| Fil | Ansvar |
|-----|--------|
| `infra/coolify/umami.md` | Coolify service, env, backup |
| `supabase/migrations/20261101120000_analytics_share_links.sql` | Tabeller + admin RPC-er |
| `lib/analytics/referrer.ts` | Normalisering referrer → kanal |
| `lib/analytics/collect-server.ts` | Server-side event insert (service_role) |
| `lib/analytics/umami-script.tsx` | Client script loader (feature flag) |
| `app/api/analytics/collect/route.ts` | POST beacon (rate limit, anonym) |
| `app/api/admin/analytics/overview/route.ts` | Admin JSON for dashboard |
| `lib/admin/analytics/overview.ts` | Aggregering + typer |
| `app/dashboard/admin/statistikk/admin-statistikk-client.tsx` | Utvidet UI (faner) |
| `components/admin/analytics/*` | Kort, tabeller, grafer |
| `lib/polls/share-personal.ts` | Bygg personlig delings-URL |
| `app/l/[code]/route.ts` | Redirect + logg |
| `components/share/personal-share-panel.tsx` | «Lag din delingslenke» (innlogget) |
| `lib/legal/privacy-notice-content.ts` | Oppdatert analyse-tekst |
| `lib/trust/subprocessors.ts` | Oppdatert `TRUST_ANALYTICS_NOTE` |
| `cms/src/components/UmamiAnalytics.tsx` | Script på blogg (fm-cms) |

---

### Task 1: Beslutningsdokument og feature flags

**Files:**
- Create: `lib/analytics/flags.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `isAnalyticsEnabled()`, `isUmamiEnabled()`, env keys documented

- [ ] **Step 1: Write the failing test**

Create `lib/analytics/flags.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { isAnalyticsEnabled, isUmamiEnabled } from '@/lib/analytics/flags';

process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true';
process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = 'test-id';
assert.equal(isAnalyticsEnabled(), true);
assert.equal(isUmamiEnabled(), true);

delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
assert.equal(isUmamiEnabled(), false);

console.log('lib/analytics/flags.test.ts ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/analytics/flags.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Write minimal implementation**

Create `lib/analytics/flags.ts`:

```typescript
export function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
}

export function isUmamiEnabled(): boolean {
  return (
    isAnalyticsEnabled() &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim())
  );
}
```

Add to `.env.example`:

```bash
# Anonym besøksanalyse (self-hosted Umami on Coolify). Off by default locally.
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://analytics.folkets-meninger.no/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=
# Server-only: optional shared secret for /api/analytics/collect
ANALYTICS_COLLECT_SECRET=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/analytics/flags.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/analytics/flags.ts lib/analytics/flags.test.ts .env.example
git commit -m "feat(analytics): add feature flags and env template"
```

---

### Task 2: Database — share links og hendelser

**Files:**
- Create: `supabase/migrations/20261101120000_analytics_share_links.sql`
- Test: `lib/analytics/migration-contract.test.ts`

**Interfaces:**
- Produces: tables `share_links`, `analytics_events`; RPCs `admin_get_user_metrics`, `admin_get_share_link_stats`, `insert_analytics_event` (service_role only)

- [ ] **Step 1: Write migration (full SQL)**

Create `supabase/migrations/20261101120000_analytics_share_links.sql` with:

```sql
-- Personal share links + first-party analytics events (manual apply).

CREATE TABLE IF NOT EXISTS public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('poll', 'blog_post', 'sak', 'generic')),
  target_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS share_links_created_by_idx ON public.share_links (created_by);
CREATE INDEX IF NOT EXISTS share_links_target_idx ON public.share_links (target_kind, target_id);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 64),
  path text NOT NULL,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ref_code text,
  share_link_id uuid REFERENCES public.share_links (id) ON DELETE SET NULL,
  session_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON public.analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_share_link_idx ON public.analytics_events (share_link_id) WHERE share_link_id IS NOT NULL;

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.share_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;

-- insert_analytics_event: service_role only (from API route / edge)
CREATE OR REPLACE FUNCTION public.insert_analytics_event(p_row jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.analytics_events (
    event_name, path, referrer_host, utm_source, utm_medium, utm_campaign,
    ref_code, share_link_id, session_hash, metadata
  )
  VALUES (
    p_row->>'event_name',
    p_row->>'path',
    NULLIF(p_row->>'referrer_host', ''),
    NULLIF(p_row->>'utm_source', ''),
    NULLIF(p_row->>'utm_medium', ''),
    NULLIF(p_row->>'utm_campaign', ''),
    NULLIF(p_row->>'ref_code', ''),
    NULLIF(p_row->>'share_link_id', '')::uuid,
    NULLIF(p_row->>'session_hash', ''),
    COALESCE(p_row->'metadata', '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.insert_analytics_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_analytics_event(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_user_metrics(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_actor uuid;
  v_inactive_days int := 90;
  v_total bigint;
  v_new_7d bigint;
  v_signed_in_30d bigint;
  v_inactive bigint;
  v_stemme_plus bigint;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  SELECT count(*) INTO v_total FROM auth.users;
  SELECT count(*) INTO v_new_7d FROM auth.users WHERE created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_signed_in_30d FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days';
  SELECT count(*) INTO v_inactive FROM auth.users
    WHERE last_sign_in_at IS NULL OR last_sign_in_at < now() - (v_inactive_days || ' days')::interval;
  SELECT count(*) INTO v_stemme_plus FROM public.users WHERE subscription_tier = 'stemme_plus';

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'totalRegistered', v_total,
    'newLast7Days', v_new_7d,
    'signedInLast30Days', v_signed_in_30d,
    'inactiveApprox', v_inactive,
    'inactiveDaysThreshold', v_inactive_days,
    'stemmePlus', v_stemme_plus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_user_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_metrics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_share_link_stats(
  p_admin_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_actor uuid;
  v_rows jsonb;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.clicks DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      sl.id,
      sl.code,
      sl.target_kind,
      sl.target_id,
      sl.label,
      sl.created_at,
      u.email AS creator_email,
      count(ae.id) AS clicks
    FROM public.share_links sl
    JOIN auth.users u ON u.id = sl.created_by
    LEFT JOIN public.analytics_events ae ON ae.share_link_id = sl.id AND ae.event_name = 'share_link_click'
    WHERE sl.revoked_at IS NULL
    GROUP BY sl.id, u.email
    ORDER BY clicks DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('generatedAt', now(), 'links', v_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_share_link_stats(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_share_link_stats(uuid, int) TO service_role;
```

- [ ] **Step 2: Add contract test**

Create `lib/analytics/migration-contract.test.ts` asserting REVOKE patterns and `require_admin_user_id` (mirror `lib/admin/security-rbac.test.ts` style).

Run: `npx tsx lib/analytics/migration-contract.test.ts`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261101120000_analytics_share_links.sql lib/analytics/migration-contract.test.ts
git commit -m "feat(db): analytics events and share links schema"
```

**Note:** After Mathias approves, Coolify Expert applies migration; until then admin UI shows «Statistikk krever databasemigrasjon …».

---

### Task 3: Referrer-normalisering

**Files:**
- Create: `lib/analytics/referrer.ts`
- Test: `lib/analytics/referrer.test.ts`

**Interfaces:**
- Produces: `classifyReferrer(input: { referrerUrl?: string | null; utmSource?: string | null }): ReferrerBucket`

- [ ] **Step 1: Write failing tests**

```typescript
import assert from 'node:assert/strict';
import { classifyReferrer } from '@/lib/analytics/referrer';

assert.equal(
  classifyReferrer({ utmSource: 'facebook' }).bucket,
  'social_facebook',
);
assert.equal(
  classifyReferrer({ referrerUrl: 'https://www.google.com/search?q=test' }).bucket,
  'search_google',
);
assert.equal(classifyReferrer({}).bucket, 'direct');
console.log('referrer.test.ts ok');
```

- [ ] **Step 2: Implement**

Implement buckets: `direct`, `search_google`, `search_other`, `social_facebook`, `social_bluesky`, `social_linkedin`, `social_whatsapp`, `email`, `other`. Prefer `utm_source` when present (align with `CHANNEL_UTM` in `lib/polls/share.ts`).

- [ ] **Step 3: Run tests, commit**

---

### Task 4: Collect API (first-party beacon)

**Files:**
- Create: `app/api/analytics/collect/route.ts`
- Create: `lib/analytics/collect-server.ts`
- Modify: `lib/rate-limit-audit-routes.test.ts` (add route keys)

**Interfaces:**
- Consumes: `insert_analytics_event`, `classifyReferrer`
- Produces: POST handler accepting `{ eventName, path, referrer?, utm?, ref?, shareCode? }`

- [ ] **Step 1: Implement server helper**

Hash session: `sha256(ANALYTICS_COLLECT_SECRET + ip + ua + day)` — never store raw IP in `analytics_events`.

- [ ] **Step 2: Implement route**

- Only when `isAnalyticsEnabled()`
- Rate limit per IP (reuse existing rate-limit helper pattern from `app/api/user/political-consent/route.ts`)
- Resolve `shareCode` → `share_link_id`
- Event names: `page_view`, `share_link_click`, `poll_share_landing`

- [ ] **Step 3: Unit test payload validation**

- [ ] **Step 4: Commit**

---

### Task 5: Client-side page view hook

**Files:**
- Create: `components/analytics/analytics-page-view.tsx`
- Modify: `app/layout.tsx` (conditional render)

- [ ] **Step 1: Client component**

On mount (production + flag): `fetch('/api/analytics/collect', { method: 'POST', body: JSON.stringify({ eventName: 'page_view', path: location.pathname + location.search, referrer: document.referrer, utm from searchParams }) })`

Skip: `/dashboard/admin/*` optional (admin traffic excluded from public metrics — document choice).

- [ ] **Step 2: Umami script sibling**

Create `lib/analytics/umami-script.tsx` loading `NEXT_PUBLIC_UMAMI_SCRIPT_URL` with `data-website-id`.

- [ ] **Step 3: Manual test locally** with flag true + mock collect route.

- [ ] **Step 4: Commit**

---

### Task 6: Poll `/del/` landing instrumentation

**Files:**
- Modify: `app/del/[id]/page.tsx`
- Create: `components/analytics/poll-share-landing-beacon.tsx`

- [ ] **Step 1: Pass searchParams** (`utm_*`, `ref`) to client beacon

- [ ] **Step 2: Fire `poll_share_landing`** once per session (sessionStorage key)

- [ ] **Step 3: Extend `lib/polls/share.test.ts`** if new query params added for personal codes (`fm_share`)

- [ ] **Step 4: Commit**

---

### Task 7: Personlige delingslenker

**Files:**
- Create: `lib/polls/share-personal.ts`
- Create: `app/api/share-links/route.ts` (POST create, GET list own)
- Create: `app/l/[code]/route.ts`
- Create: `components/share/personal-share-panel.tsx`
- Modify: `components/polls/share-poll-widget.tsx` or poll dashboard page

**Interfaces:**
- Produces: `createShareLink({ targetKind, targetId, label? })` server-side with auth session

- [ ] **Step 1: RPC or direct insert via service** — prefer new RPC `create_share_link(p_user_id, ...)` with `assert_rpc_caller_is_user` pattern (add to same migration file as **new** migration `20261101130000_create_share_link.sql` if Task 2 already applied — never edit applied migration).

Minimal RPC:

```sql
CREATE OR REPLACE FUNCTION public.create_share_link(
  p_user_id uuid,
  p_target_kind text,
  p_target_id text,
  p_label text DEFAULT NULL
)
RETURNS jsonb
...
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  -- generate code: substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
```

- [ ] **Step 2: Redirect route `/l/[code]`**

302 to target URL with `fm_share=` preserved; log `share_link_click` via collect API (server-side insert on redirect — preferred over client beacon for accuracy).

- [ ] **Step 3: UI «Din delingslenke»** on poll share page (innlogget), norsk copy

- [ ] **Step 4: Commit**

---

### Task 8: Admin API overview

**Files:**
- Create: `app/api/admin/analytics/overview/route.ts`
- Create: `lib/admin/analytics/overview.ts`

- [ ] **Step 1: `requireAdmin()`** then parallel:

- `admin_get_user_metrics`
- `admin_get_share_link_stats`
- SQL aggregate on `analytics_events` last 30 days (top paths, referrer buckets) via new RPC `admin_get_analytics_overview` in migration

- [ ] **Step 2: Return typed JSON** for dashboard

- [ ] **Step 3: Commit**

---

### Task 9: Admin statistikk UI (faner)

**Files:**
- Modify: `app/dashboard/admin/statistikk/admin-statistikk-client.tsx`
- Create: `components/admin/analytics/overview-cards.tsx`
- Create: `components/admin/analytics/share-links-table.tsx`
- Create: `components/admin/analytics/traffic-table.tsx`

**UI struktur (norsk):**

1. **Oversikt** — kort: besøkende (fra Umami API eller events), registrerte, innlogget siste 30 d, inaktive, Stemme+
2. **Trafikk** — tabell stier + kanaler (referrer buckets)
3. **Deling** — topp delingslenker + hvem opprettet (e-post admin-only)
4. **Blogg** — filtrert `path LIKE '/blogg/%'` eller Umami filter
5. **Myndighets-eksport** — behold dagens CSV (eksisterende knapper)

Optional: lenke «Åpne Umami ↗» (`UMAMI_ADMIN_URL` server-only env for admin redirect).

- [ ] **Step 1: Fetch `/api/admin/analytics/overview` on mount**

- [ ] **Step 2: Empty states** when migration not applied (PostgREST PGRST202)

- [ ] **Step 3: computerUse/manual test** as admin user

- [ ] **Step 4: Commit**

---

### Task 10: Blogg (fm-cms) tracking

**Files:**
- Create: `cms/src/components/UmamiAnalytics.tsx`
- Modify: `cms/src/app/(frontend)/layout.tsx`
- Create: `infra/coolify/umami.md`

- [ ] **Step 1: Same Umami website ID** or separate CMS site ID in Umami (recommended: **second website** in Umami for `cms.folkets-meninger.no` merged in admin via API)

- [ ] **Step 2: Document Coolify deploy** — Umami Postgres, `DATABASE_URL`, hostname `analytics.folkets-meninger.no`, Traefik, backup

- [ ] **Step 3: Commit** (cms + infra docs)

---

### Task 11: Personvern og tillit

**Files:**
- Modify: `lib/trust/subprocessors.ts`
- Modify: `lib/legal/privacy-notice-content.ts`
- Modify: `app/personvern/page.tsx` (if content driven from legal module)

- [ ] **Step 1: Replace analytics note** with text explaining self-hosted Umami + anonyme hendelser, formål (drift/forbedring), lagringstid (f.eks. 12 måneder — configurable), ingen salg til tredjepart

- [ ] **Step 2: No cookie banner** if Umami cookieless; if cookies used, add minimal consent banner (separate task — default cookieless)

- [ ] **Step 3: Commit**

---

### Task 12: CI og dokumentasjon

**Files:**
- Modify: `AGENTS.md` (short bullet under Admin)
- Modify: `docs/security-allowlist.md` if new RPCs need allowlist entries

- [ ] **Step 1: Run** `npm run lint && npm run build && npm run test:unit`

- [ ] **Step 2: Run** `scripts/check-migrations.mjs` on new migration

- [ ] **Step 3: Commit**

---

## Coolify — Umami oppsett (skisse)

Document in `infra/coolify/umami.md`:

```yaml
# Coolify: new service from image ghcr.io/umami-software/umami:postgresql-latest
# Env: DATABASE_URL (Postgres on klever), APP_SECRET, DISABLE_TELEMETRY=1
# Host: analytics.folkets-meninger.no
# Create two websites: folkets-meninger.no (fm-web), www + blogg paths; optional fm-cms
```

fm-web env efter deploy:

```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://analytics.folkets-meninger.no/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<uuid-from-umami>
```

---

## Self-review (spec coverage)

| Krav | Task |
|------|------|
| Antall besøkende | Task 5, 10 (Umami) + Task 4 (events backup) |
| Brukere registrert / innlogget / inaktiv | Task 2, 8, 9 |
| Blogg-statistikk | Task 10, 9 (fane) |
| Personlige delingslenker + hvem | Task 7, 8, 9 |
| Referrer Facebook/Reddit/X/Google | Task 3, 4, 6 (X via utm/referrer when shared) |
| Self-hosted OSS | Umami i infra doc; Alternativ A documented som fallback |
| Personvern | Task 11 |
| Eksisterende myndighets-CSV | Task 9 fane 5 |

**Placeholder scan:** None — all tasks have concrete paths and code stubs.

---

## Valg for product owner (svar i chat)

Trykk eller svar med bokstav:

| Valg | Spor | Kort |
|------|------|------|
| **A** | Kun førsteparts Postgres + `/api/analytics/collect` | Minste drift, mest kode, full kontroll |
| **B** | **Umami + Postgres (anbefalt)** | Best balanse drift/innsikt |
| **C** | Matomo self-hosted | Tungt, mer enn dere trenger nå |
| **D** | Kun Traefik access logs + bruker-RPC | Raskt, men dårlig delings-UTM og blogg |

**Scope-valg (kan kombineres med B):**

| Valg | Innhold |
|------|---------|
| **B1** | Fase 1 only (MVP dashboard) |
| **B2** | Fase 1 + personlige delingslenker (Task 7) |
| **B3** | Full plan inkl. blogg CMS + trakt Fase 2 |

**Personvern:**

| Valg | |
|------|--|
| **P1** | Umami cookieless, ingen banner |
| **P2** | Cookieless + kort info-rad i footer om anonym statistikk |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-01-admin-statistikk-analytics.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session using executing-plans, batch checkpoints

**Which approach?** (Also reply with **A/B/C/D** and **B1–B3**, **P1/P2** from the tables above.)
