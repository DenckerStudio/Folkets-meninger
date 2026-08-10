# Coolify / infrastruktur — Alternativ C + forum-fjerning

Dette dokumentet er **planleggingsnotat** (ikke implementert enda). Det beskriver:

1. **Alternativ C** — fortsatt **hosted Supabase**, redusert egress via Coolify (Redis, cache-disiplin, n8n/ops), uten full self-host av Postgres ennå.
2. **Full fjerning av forum** fra produktet — alt bruker-/admin-UI, API, n8n-pipeline og DB-funksjonalitet knyttet til forum/reels.

Relatert produktarbeid: avstemninger/initiativ (PR #57, `polls` / `citizen_initiatives`) må **avkobles fra forum** før eller under forum-fjerning.

---

## Overordnet mål

| Mål | Indikator |
|-----|-----------|
| Lavere Supabase egress | Dashboard + logg: færre store SELECT, færre n8n full-table scans |
| Enklere produkt | Ingen `/dashboard/forum/*`, ingen forum i nav, ingen reels-pipeline |
| Stabil drift på Coolify | Redis for app-cache; n8n + Ollama + SearXNG som i dag |
| Bevare kjernen | Stortinget-saker, sak-stemming (`citizen_votes`), høringer (`hearing_comments`), avstemninger |

---

## Alternativ C — faser (nærmere)

### Fase C0 — Baseline og måling (1–2 dager arbeid)

**Gjør:**

- Supabase Dashboard → **Database** → egress / query insights (7 og 30 dager).
- Liste topp-kallere:
  - App: `lib/stortinget-saker-cache.ts`, `lib/stortinget-detail-cache.ts`, `lib/forum/queries.ts` (fjernes), document chunks / RAG.
  - n8n: workflows som SELECT fra Postgres uten `LIMIT` (forum-prompts, embeddings, AI summary med `detail_json`).
- Dokumenter nåværende Coolify-tjenester: n8n, Ollama, SearXNG (`infra/searxng/`).
- Definer **SLO**: mål egress % reduksjon etter C1+C2 (f.eks. −30 % mot baseline).

**Leveranse:** tabell «kilde → estimert egress → tiltak» i dette filens appendix (oppdateres etter C0).

### Fase C1 — Redis på Coolify (app read-cache)

**Gjør:**

- Ny stack under `infra/coolify/redis/` (docker-compose eller Coolify service template):
  - Redis 7, passord, ingen offentlig port (kun privat nett / Tailscale).
- App-env: `REDIS_URL` (server-only).
- Første cache-lag (prioritet):
  1. **Stortinget sak-liste** — nøkkel per `session_id` + `periode_id`, TTL 30 min (align med eksisterende memory/`unstable_cache`).
  2. **Stortinget sak-detalj metadata** — ikke full `detail_json` i cache; kun felter for liste/status overlay.
  3. **Poll totals** — `get_poll_totals` / per-fylke, TTL 1–5 min etter stemmegiving.
- **Cache-aside** i `lib/`: miss → Supabase/Stortinget → set Redis.
- Ved deploy: graceful fallback hvis Redis nede (samme som dagens DB/live fallback).

**Ikke:** cache persondata eller vote receipts; ikke cache service-role payloads til browser.

**Validering:** sammenlign egress før/etter på sak-liste og poll-sider.

### Fase C2 — n8n og batch-disiplin

**Gjør:**

- Audit alle n8n Postgres-noder:
  - Erstatt `SELECT *` / full `detail_json` med kolonne-lister og `LIMIT`.
  - AI summary: hent kun `title`, `summary`, komprimert kontekst (ikke hele `detail_json` hvis unødvendig).
  - Document embeddings: batch på `pending` chunks med indeks, ikke full scan.
- Cron på app (`/api/cron/sync-issues`) — allerede egress-bevisst; dokumenter at n8n ikke dupliserer full sync.
- Valgfritt: flytt **read-heavy** aggregater til materialiserte views i Postgres (poll totals allerede via RPC).

**Forum-fjerning (F2)** reduserer egress ytterligere: ingen `forum_prompts` / scout / cluster reads.

### Fase C3 — Observability og grenser

- Varsel når egress > terskel (Supabase billing eller daglig rapport).
- Coolify healthchecks for Redis, n8n, Ollama.
- Runbook: «Redis flush», «n8n workflow paused», «fallback uten cache».

### Fase C4 — (valgfri, senere) self-host Postgres

**Ikke del av Alternativ C nå.** Re-evaluer når egress fortsatt høy etter C1–C2 + forum-fjerning, eller når compliance krever det.

---

## Full forum-fjerning — faser (nærmere)

Forum er dypt integrert (~90 filer med `forum` i navn/sti, pluss migrasjoner og n8n). Fjerning bør være **sekvensert** for å unngå brutte polls og poeng/notifikasjoner.

### Fase F0 — Scope og produktbeslutninger

**Bekreft utenfor kode:**

| Emne | Forslag | Alternativ |
|------|---------|------------|
| «Top arguments» på avstemninger | Fjern UI + `get_poll_top_arguments` | Ny tabell `poll_arguments` (moderert, uten tråder) |
| Citizen initiativ | Initiativ uten forum-tråd; kun tittel/body i `citizen_initiatives` | — |
| Poeng / gamification | Fjern forum-poeng; behold kun sak-stemme + avstemning? | Enkel poengmodell senere |
| Offentlig profil | Fjern forum-innlegg på `/profil/[id]` | Kun stemmer/avstemninger |
| `user_has_forum_identity` | Behold for høringer og avstemninger (navn) | Rename til `user_has_public_identity` |
| Admin | Fjern forum-prompts, clusters, reports | — |

**Leveranse:** signert scope (denne tabellen oppdatert).

### Fase F1 — Stopp n8n og webhooks (prod før kode)

1. Deaktiver i n8n (ikke slett ennå):
   - `forum-prompt-generator`, `forum-regjeringen-rss-ingest`, `forum-sak-prompt-generator`, scout/research/trending (deprecated v7–v11).
2. Fjern/tomme app-env på Vercel/Coolify:
   - `N8N_FORUM_PROMPTS_WEBHOOK_URL`, `N8N_FORUM_SYNTHESIS_WEBHOOK_URL`, `N8N_FORUM_RSS_WEBHOOK_URL`, `N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL`, `FORUM_REELS_PUBLIC`.
3. `FORUM_ADMIN_EMAILS` — erstatt med generell `ADMIN_EMAILS` eller kun `app_metadata.role` (migrer allowlist).

**Egress-effekt:** umiddelbar reduksjon fra n8n som leser `forum_*` og store prompt-tabeller.

### Fase F2 — App: fjern routes, API, UI

**Slett eller redirect:**

| Område | Handling |
|--------|----------|
| `app/dashboard/forum/**` | Fjern; redirect `/dashboard/forum` → `routes.utforsk` eller `routes.avstemninger` |
| `app/dashboard/admin/forum-*` | Fjern |
| `app/api/forum/**` | Fjern |
| `app/api/admin/forum-*` | Fjern |
| `components/forum/**` | Fjern |
| `lib/forum/**` | Fjern (unntak: delt validering flyttes til `lib/identity` / `lib/moderation` om nødvendig) |
| `lib/trigger-forum-sak-prompt-webhook.ts` | Fjern |
| `middleware.ts` | Fjern `/api/forum/:path*` |
| `lib/routes.ts` | Fjern forum-routes; oppdater `isPublicDashboardSakPath` om den refererer forum |
| `lib/site-nav-links.ts` | Fjern «Forum» fra desktop/mobile nav |
| `app/dashboard/page.tsx` | Redirect til `utforsk` eller `avstemninger` (ikke `routes.forum`) |
| `app/page.tsx`, login, complete-profile | Fjern forum som default landing |
| Sak-side | Fjern forum CTA, related discussions, sak-reel admin-knapper |
| `components/profile/*` | Fjern forum-poeng, forum-innlegg, forum-notifikasjoner |
| `e2e/reel-flow.spec.ts`, `e2e/sak-rag-admin.spec.ts` | Fjern eller erstatt |

**Behold (ikke forum):**

- `hearing_comments` + `POST /api/hearings`
- `citizen_votes` + `/api/vote`
- Avstemninger under `app/dashboard/avstemninger/**`

**Polls-oppfølging i samme PR/serie:**

- `components/polls/poll-card.tsx`, `initiative-progress.tsx` — fjern lenker til `routes.forumTopic`
- `lib/polls/service.ts` — fjern `get_poll_top_arguments`, `forumThreadId` i UI
- `app/api/initiatives/route.ts` — ikke opprette forum-tråd via RPC

### Fase F3 — Database: avkoble polls, deretter deprecate forum

**Steg 3a — Polls uten forum (ny migrasjon):**

```text
- citizen_initiatives.forum_thread_id → nullable eller fjern kolonne (etter backfill)
- polls.forum_thread_id → nullable / fjern
- create_citizen_initiative: ikke kalle create_forum_thread
- DROP eller no-op get_poll_top_arguments
- promote_citizen_initiative_to_poll: uten forum_thread_id
```

**Steg 3b — Fjern forum-RPC execute og app-tilgang:**

- `create_forum_thread`, `create_forum_reply`, `toggle_forum_like`, `toggle_forum_dislike`, forum report RPCs — revoke / drop etter F2 deploy.

**Steg 3c — Tabeller (kun etter prod deploy uten forum-kode):**

Valgfri **arkivering** før DROP:

- Eksporter `forum_threads`, `forum_replies`, `forum_prompts` til S3/kold storage om historikk trengs.

DROP (typisk liste — verifiser med `list_tables`):

- `forum_threads`, `forum_replies`, `forum_likes`, `forum_dislikes`, `forum_reports`
- `forum_prompts`, `forum_prompt_votes`, `forum_trusted_sources`, `forum_research_*`, `forum_moderation_*`
- Triggers: `award_points_for_forum_*`
- Oppdater `supabase/README.md` og fjern forum fra runbooks

**RLS:** fjern policies på dropped tables.

### Fase F4 — Repo hygiene

- `workflows/n8n/forum-*` → flytt til `workflows/n8n/archive/forum/` eller slett med note i `workflows/n8n/README.md`
- `scripts/deploy-forum-*`, `scripts/build-n8n-forum-*` — fjern eller arkiver
- `.env.example` — fjern FORUM_* og N8N_FORUM_*
- `AGENTS.md` — fjern forum/reels runbooks; legg til denne planen
- `npm run lint`, `npm run build`, `test:e2e` — oppdater smoke til ny default route

### Fase F5 — Verifisering

- [ ] Ingen lenke i UI til `/forum`
- [ ] Ingen 404 fra nav på prod
- [ ] Egress 7d vs baseline (C0)
- [ ] n8n: ingen aktiv workflow med `forum_` tabeller
- [ ] Opprette initiativ + stemme i avstemning uten forum
- [ ] Høring-kommentar fortsatt fungerer med navn-krav

---

## Avhengigheter mellom C og F

Anbefalt **parallelle spor** med synk-punkter:

```mermaid
flowchart LR
  C0[C0 måling]
  F0[F0 scope]
  F1[F1 n8n off]
  F2[F2 app fjern]
  F3[F3 DB]
  C1[C1 Redis]
  C2[C2 n8n audit]

  C0 --> C1
  C1 --> C2
  F0 --> F1
  F1 --> F2
  F2 --> F3
  F1 --> C2
  F3 --> C0
```

- **F1 før C2** gir renere n8n-audit (færre workflows).
- **F2 + F3a** må lande sammen eller F2 før 3a med bakoverkompatibel RPC.
- **C1** kan starte uavhengig av forum (sak-liste cache gir verdi uansett).

---

## Estimert egress-gevinster (kvalitativ)

| Tiltak | Forventning |
|--------|-------------|
| Forum n8n av | Høy — store reads på prompts/clusters/sources |
| Forum app/API borte | Middels — bruker-queries på tråder/replies/likes |
| Redis på sak-liste | Middels — repeterte DB reads |
| Fjern `detail_json` i n8n | Høy per workflow-run |
| Forum DB DROP | Lav egress direkte, mindre backup/storage |

---

## Risiko og rollback

| Risiko | Mitigasjon |
|--------|------------|
| Polls/initiativ brekt | F3a før DROP; feature flag `POLLS_PUBLIC` om nødvendig |
| Admin uten verktøy | Bekreft at forum-admin ikke erstatter kritisk ops |
| Poeng/notifikasjoner | Migrer prefs — fjern `forum` kanal fra UI før DB |
| SEO/bookmarks til `/forum` | 301 til utforsk/avstemninger |
| PR #57 | Rebasing: enten forum-fjerning på egen branch `cursor/remove-forum-c641` etter merge polls, eller samlet branch med tydelig commit-rekkefølge |

Rollback F2: redeploy forrige release (forum-kode fortsatt i git history). Rollback F3c: ikke DROP uten backup; bruk arkivering.

---

## Appendix — filkart (forum, utdrag)

**App:** `app/dashboard/forum/**`, `app/api/forum/**`, `app/api/admin/forum-**`, `app/dashboard/admin/forum-**`

**Lib:** `lib/forum/**`, `lib/trigger-forum-sak-prompt-webhook.ts`

**Komponenter:** `components/forum/**` (18 filer)

**n8n:** `workflows/n8n/forum-*.workflow.ts`, `FORUM-PROMPTS-v*.md`

**Polls-kobling:** `supabase/migrations/20260805120000_direct_democracy_polls.sql` (`forum_thread_id`, `get_poll_top_arguments`, `create_citizen_initiative` → `create_forum_thread`)

**Nav / default:** `lib/site-nav-links.ts`, `app/dashboard/page.tsx` → `routes.forum`

---

## Neste konkrete steg (handoff)

1. Godkjenn F0-tabellen (top arguments, poeng, landingsside).
2. Kjør C0 egress-snapshot i Supabase.
3. Opprett branch `cursor/remove-forum-c641` (eller fortsett på polls-branch etter avklaring).
4. F1: slå av forum-n8n i prod.
5. F2 + F3a i én eller to PR-er; deretter C1 Redis.
