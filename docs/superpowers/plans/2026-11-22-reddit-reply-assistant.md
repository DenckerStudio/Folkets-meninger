# Reddit-svarassistent — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La lokal AI (Ollama via n8n) foreslå **når** et Reddit-interessesignal er verdt et menneskelig svar, og deretter generere **svarutkast** admin kan redigere og lime inn manuelt — med myk, indirekte henvisning til Folkets Meninger, uten auto-posting og uten å lagre Reddit-selftext/author i DB.

**Architecture:** To lag oppå eksisterende `reddit_signals` + `research_topics`:

1. **Svarverdi-score** (`reply_worth`) — billig heuristikk + Ollama-klassifisering; synlig i Interessesignaler.
2. **Svarutkast** — kun for høy score (eller admin-override); henter posttekst midlertidig via Arctic Shift; bruker tema-brief når den finnes; skriver 1–3 utkast til `research_topic_reply_drafts` (kun *generert* tekst).

**Tech Stack:** Next.js 15 App Router (admin), Supabase Postgres + RLS/RPC (`service_role` for n8n), n8n webhooks (HMAC), Ollama `gemma4:26b`, Arctic Shift (read-only), eksisterende tema-brief-flyt.

## Global Constraints

- **Nothing merges to `main` without Mathias' explicit yes.** Branch `cursor/…`, PR, grønn CI.
- **Migrations are never auto-applied.** Coolify Expert applies manually after Mathias says yes. New migration only; never edit applied migrations.
- **Never put secrets in code, commits, PR text, or logs.**
- **Hosting is Coolify** (not Vercel). Ollama kalles **kun via n8n**, aldri direkte fra fm-web.
- **Reddit = interessesignal, ikke fakta.** Aldri bruk Reddit som publishable source i brief/svar-grunnlag. Fakta fra tema-brief / ikke-Reddit-kilder.
- **Lagre aldri** author, selftext eller comments i `reddit_signals` (kontrakt: `docs/n8n/reddit-signals-contract.md`). Posttekst kun ephemeral i n8n-jobb.
- **Ingen outbound Reddit-posting** i denne planen (Mathias-gated «utgående poster»). Admin kopierer tekst.
- **All admin UI copy is Norwegian bokmål.** No English UI strings. No «AI»-badge/etikett i UI. No BankID/MinID.
- **`research_topics.title` eksponeres ikke** på offentlige API-er.
- **New tables/functions:** explicit `REVOKE`/`GRANT`, RLS, table DDL as `postgres`; **`n8n_*` RPCs → `service_role` only**.
- **CI:** `npm run lint`, `npm run typecheck`, `npm run test:unit`, db-security / migration-sql-lint on changed migrations.

---

## Nåsituasjon (baseline)

| Område | I dag | Gap |
|--------|--------|-----|
| Ingest | Arctic Shift → `n8n_upsert_reddit_signals` (metadata + metrics) | Ingen svarverdi |
| Relevans | `ai_relevance` 1–5 (+ `ai_reason` / `ai_model` / `ai_scored_at`) = *produkt-/research*-relevans | Ikke det samme som «verdt å svare» |
| Admin UI | `/dashboard/admin/research?view=signaler` — sort på score/comments/relevance/… | Ingen «Verdt å svare»-badge / sort |
| Tema-brief | «Bruk funn» → `research_topics` + n8n brief | Brief brukes til blog/sak/poll, ikke Reddit-svar |
| Svar / outreach | Ingen | Ingen draft-tabell, API eller panel |
| Posting | Read-only | Skal forbli slik i v1 |

**Eksempelcase:** tråd om hvorfor folk varsler (`r/norge`) — god kandidat for hjelpsomt svar + myk bro til plattformen, men krever menneskelig tone og faktagrunnlag utenom Reddit.

---

## Løsningsvalg

### Anbefalt: **Svarverdi først, deretter utkast (to faser)**

| | A: Kun heuristikk | B: Heuristikk + Ollama-score (anbefalt) | C: Alltid generer utkast |
|--|-------------------|----------------------------------------|---------------------------|
| Kostnad Ollama | 0 | Lav (klassifisering) | Høy |
| Treffsikkerhet | Svak på tone/tema | God nok til kø | Støy |
| Admin-arbeid | Manuell scanning | Sortert «verdt å svare»-kø | Review-kø oversvømmes |
| Passer GP666 (én Ollama-jobb) | — | Batch/kø ok | Dårlig |

**Ikke i v1:** auto-post, lagring av Reddit-body, offentlig UI, hard CTA / Stemme+-pitch i utkast.

### Skille: `ai_relevance` vs `reply_worth`

| Felt | Betydning |
|------|-----------|
| `ai_relevance` (finnes) | Er signalet interessant for *research* (sak/blogg/poll)? |
| `reply_worth` (ny) | Er det verdt at *vi svarer* på Reddit (hjelp + myk synlighet)? |

En tråd kan ha høy research-relevans og lav svarverdi (f.eks. nyhetslink uten diskusjon), eller omvendt (engasjert spørsmål der vi kan hjelpe uten å ha sak klar ennå).

---

## Produktregler for «verdt å svare»

Ollama skal score `reply_worth` 1–5 med kort norsk `reply_worth_reason`. Rubrikk:

| Score | Betydning | Admin-handling |
|-------|-----------|----------------|
| 5 | Sterk: åpent spørsmål / samfunnsdiskusjon der FM kan hjelpe faktabasert, godt tidsvindu | Generer utkast |
| 4 | God: relevant tema + engasjement; myk henvisning naturlig | Generer utkast |
| 3 | Mulig: borderline; admin avgjør | Override mulig |
| 1–2 | Nei: meme, meta, spam, ren nyhetslink, toksisk, allerede overfylt, dårlig fit | Skjul i standard kø |

**Positive signaler:** spørsmål/diskusjon, demokrati/politikk/tillit/varsling/medborgerskap, moderat engasjement, fersk tråd, norsk bokmål-tone passer, plass til ett hjelpsomt innlegg.

**Negative signaler:** «hvilken bank…», shopping, meme, brigade, allerede 200+ kommentarer uten at vi har unik verdi, fjernet/blokkert, åpenbar promo-felle, trenger juridisk råd vi ikke skal gi.

**Myk henvisning (utkastfase):** maks én bro-setning; aldri hard CTA, «last ned», Stemme+, eller «som AI». Svaret skal stå alene som nyttig også uten lenke.

---

## Datamodell

### Fase 1 — kolonner på `reddit_signals`

Ny migrasjon (eks. `YYYYMMDDHHMMSS_reddit_reply_worth.sql`):

```sql
ALTER TABLE public.reddit_signals
  ADD COLUMN IF NOT EXISTS reply_worth smallint,
  ADD COLUMN IF NOT EXISTS reply_worth_reason text,
  ADD COLUMN IF NOT EXISTS reply_worth_model text,
  ADD COLUMN IF NOT EXISTS reply_worth_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_worth_status text NOT NULL DEFAULT 'pending';
  -- pending | scored | skipped | failed
  ADD COLUMN IF NOT EXISTS reply_gate_passes boolean; -- heuristikkresultat (debug/filter)
```

Constraints: `reply_worth` NULL eller 1–5; `reply_worth_status` i enum over. Index: `(reply_worth DESC NULLS LAST)` WHERE status = 'ny'.

**RPC (service_role only):** `n8n_set_reddit_reply_worth(p_reddit_id, p_worth, p_reason, p_model, p_status, …)`.

### Fase 2 — `research_topic_reply_drafts`

```text
id uuid PK
research_topic_id uuid NULL → research_topics
reddit_signal_id uuid NOT NULL → reddit_signals
status text  -- queued | running | done | failed
request_id uuid
variants jsonb  -- [{ tone, body, include_soft_link }]  kun generert tekst
selected_variant int NULL
edited_body text NULL  -- admin-redigert kopi
error text NULL
created_by uuid
heartbeat_at / started_at / finished_at / created_at / updated_at
```

RLS on; `REVOKE` anon/public; admin via existing gate + authenticated policies mirror research_topics; `n8n_upsert_reddit_reply_draft` / `n8n_set_reddit_reply_draft_output` → **service_role only**.

**Ikke lagre:** Reddit selftext, author, raw prompt med full body utover det som trengs i ephemeral n8n (body skal ikke skrives tilbake til Postgres).

---

## Flyt

```text
Ingest / snapshot update
        │
        ▼
Heuristikk (n8n eller fm-web batch): reply_gate_passes?
   nei → reply_worth_status=skipped
   ja  → queue Ollama klassifisering
        │
        ▼
n8n + Ollama → reply_worth 1–5 + reason
        │
        ▼
Admin Interessesignaler
  sort/filter «Verdt å svare» (worth ≥ 4)
  badge + reason tooltip
        │
        ├── [worth ≥ 4] «Skriv svarutkast»
        │         │
        │         ├─ optional: enqueue tema-brief hvis mangler / ikke publishable
        │         ▼
        │    n8n: Arctic Shift fetch body (ephemeral)
        │    + brief facts (hvis publishable)
        │    + Ollama → 2–3 variants
        │         ▼
        │    Panel: rediger / kopier / marker brukt
        │
        └── [worth ≤ 3] skjult i default; «Override: lag utkast» i meny
```

---

## Fase 1 — Svarverdi-score (bygg først)

### Task 1.1: Migrasjon + RPC

- [x] Ny migrasjon med kolonner, CHECKs, index, RLS uendret på tabell (allerede enabled).
- [x] `n8n_set_reddit_reply_worth` — `REVOKE` PUBLIC/anon/authenticated; `GRANT EXECUTE` til `service_role` only.
- [x] `supabase/tests/` SQL-test speiler `reddit_signals_v2.sql`-mønster.
- [x] Oppdater `docs/n8n/reddit-signals-contract.md` med nye felter (skriv-RPC; upsert ignorerer fortsatt selftext).

### Task 1.2: Heuristikk (deterministisk gate)

- [x] Modul `lib/reddit-signals/reply-worth-gate.ts` + co-located test.
- [x] Regler (startverdier, justerbare konstanter):
  - `status === 'ny'`
  - alder: `posted_at` innen ~72 t (konfigurerbar)
  - `num_comments` ≥ 3 og ≤ 150 (unngå død / overfylt)
  - `score` ≥ 5
  - tittel ikke matcher meme/shopping-blocklist (enkel regex; feedback senere)
  - `removal_type` null / ikke fjernet
- [x] Eksport `passesReplyWorthGate(row) → { pass, reasons[] }`.

### Task 1.3: n8n-klassifisering

- [x] Webhook-path f.eks. `reddit-reply-worth` under `N8N_RESEARCH_WEBHOOK_BASE` **eller** egen schedule-jobb som scanner `reply_worth_status=pending` + gate pass.
- [x] Anbefalt: **schedule i n8n** (hvert 10–15 min) som:
  1. Henter kandidater via service_role (ny RPC `n8n_list_reddit_reply_worth_candidates` eller filtrert REST).
  2. Kjører gate.
  3. For pass: Ollama JSON `{ worth: 1-5, reason: "…" }` med systemprompt = rubrikken over + produktkontekst (2–3 setninger om Folkets Meninger).
  4. Skriver via `n8n_set_reddit_reply_worth`.
- [x] Input til modellen: **kun** title, subreddit, score, comments, contention, flair, related_issue_title (hvis finnes) — **ikke** selftext i fase 1 (raskt + personvern). Fase 1.5 (valgfritt): ephemeral title+body for bedre score.
- [x] Kontrakt i `docs/n8n/reddit-signals-contract.md` eller ny `docs/n8n/reddit-reply-worth-contract.md`.
- [x] Workflow SDK-kilde under `workflows/n8n/` (følg eksisterende mønster); **ikke** importer JSON til prod uten eier-prosess.

### Task 1.4: Admin UI — Interessesignaler

- [x] Utvid `RedditSignalAdminRow` + list SELECT med `replyWorth`, `replyWorthReason`, `replyWorthStatus`.
- [x] Ny sort-key `reply_worth` i `REDDIT_SIGNAL_SORT_KEYS` + label «Svarverdi».
- [x] Filter: «Kun verdt å svare» (`reply_worth >= 4`) + chip/badge «Verdt å svare» (norsk, uten «AI»).
- [x] Tooltip/ekspand: `reply_worth_reason`.
- [x] Tomtilstand når filter aktivt og ingen treff.
- [x] Unit tests for query builders / labels / gate; manuell smoke i admin når env tillater.

**Ferdig kriterium fase 1:** Admin kan sortere/filtrere på svarverdi; scorer oppdateres av n8n; ingen utkast ennå.

---

## Fase 2 — Svarutkast

### Task 2.1: Migrasjon drafts + RPCs

- [ ] Tabell `research_topic_reply_drafts` + RLS + grants.
- [ ] `n8n_upsert_reddit_reply_draft` / `n8n_set_reddit_reply_draft_output` (service_role only).
- [ ] SQL-tester.

### Task 2.2: fm-web enqueue API

- [ ] `POST /api/admin/research/reddit-signals/[signalId]/reply-draft`
  - Krever admin gate.
  - Default: avvis med 409 hvis `reply_worth < 4` med mindre `force: true`.
  - Oppretter draft-rad `queued`; POST HMAC webhook `reddit-reply-draft`.
  - Speil feilkoder/norske meldinger som research topics.
- [ ] `GET` samme path: poll status + variants.
- [ ] `PATCH`: lagre `edited_body` / `selected_variant` (kun admin).

### Task 2.3: n8n draft-workflow

- [ ] Hent signal metadata + optional `research_topics` brief (publishable facts only).
- [ ] Arctic Shift: hent selftext ephemeral; **ikke** upsert body til DB.
- [ ] Hvis brief mangler/ikke publishable: generer «rått» utkast merket i UI «Uten faktagrunnlag — sjekk kilder før du poster» og foreslå «Bruk funn» først.
- [ ] Ollama: 2–3 varianter (nøytral / engasjert / kort), bokmål, myk lenke valgfri i én variant.
- [ ] Skriv `variants` JSON via RPC; status `done` / `failed`.

### Task 2.4: Admin panel

- [ ] Fra signal-rad (worth ≥ 4): knapp «Skriv svarutkast».
- [ ] Fra tema-brief-side når `source_kind=reddit`: samme panel.
- [ ] UI: vise varianter, textarea for redigering, «Kopier», «Åpne tråd» (ekstern), «Marker brukt» (eksisterende action).
- [ ] Ingen auto-åpning av Reddit compose (browser-policy); copy + ekstern lenke er nok.
- [ ] Co-located client helpers + tests for canCreate / force rules.

### Task 2.5: Kontrakter og docs

- [ ] Oppdater `docs/n8n/research-webhook-contract.md` (eller egen reply-draft-kontrakt).
- [ ] Kort note i `docs/agents/reference.md` under Reddit: svarassistent = admin draft only.
- [ ] AGENTS.md: én linje under Never/More — «Reddit-svar: kun manuell liming; ingen auto-post».

**Ferdig kriterium fase 2:** Fra et verdt-signal kan admin bestille utkast, redigere, kopiere; DB inneholder ikke Reddit-body.

---

## Fase 3 — Læring (valgfritt, etter MVP)

- [ ] Feedback: «Bra forslag» / «Ikke svarverdi» på score → `reddit_signal_feedback` action-typer `reply_worth_up` / `reply_worth_down`.
- [ ] Etter posting: valgfri status `svart` (ny signal-status) vs bare `brukt`.
- [ ] Juster gate-terskler fra feedback-aggregater (`reddit_learning_stats`-utvidelse).
- [ ] Fase 1.5: ephemeral body i scoring for bedre precision.

---

## Prompt-skisser (n8n)

### Klassifisering (fase 1)

```text
Du vurderer om Folkets Meninger bør svare i en norsk Reddit-tråd.
Produkt: plattform for meninger, saker og avstemninger om norsk politikk/samfunn.
Score 1–5 etter rubrikk. Svar KUN JSON: {"worth":n,"reason":"…"} på bokmål, reason ≤ 140 tegn.
Ikke foreslå å auto-poste. Ikke behandle Reddit som faktakilde.
```

### Utkast (fase 2)

```text
Skriv 2–3 svarvarianter på bokmål som hjelper OP/tråden først.
Bruk kun fakta fra «brief»-blokken; hvis brief mangler, vær forsiktig og unngå påstander.
Maks én myk henvisning til folkets-meninger.no i én variant.
Ingen hard salg, ingen Stemme+, ingen «som AI», ingen engelsk.
Returner JSON: {"variants":[{"tone":"nøytral|engasjert|kort","body":"…","include_soft_link":bool}]}
```

---

## Testplan

| Type | Hva |
|------|-----|
| Unit | `reply-worth-gate`, sort/filter query, canEnqueueDraft (worth/force), JSON schema parse for variants |
| SQL | RPC grants, CHECK constraints, upsert/set output |
| Manual admin | Filtrer «Verdt å svare», les reason, force-draft på score 3, kopier tekst, bekreft at selftext ikke i DB |
| n8n | Dry-run klassifisering + én draft mot staging/local; sjekk Ollama-kø (GP666) |

**Ikke:** e2e mot live Reddit posting; ikke `supabase db push` fra agent.

---

## Filkart (forventet touch set)

| Path | Rolle |
|------|--------|
| `supabase/migrations/*_reddit_reply_worth.sql` | Kolonner + RPC |
| `supabase/migrations/*_reddit_reply_drafts.sql` | Draft-tabell + RPC |
| `supabase/tests/reddit_reply_worth.sql` | SQL-tester |
| `lib/reddit-signals/reply-worth-gate.ts` | Heuristikk |
| `lib/reddit-signals/types.ts` / `query.ts` / `labels.ts` / `service.ts` | List/sort/filter |
| `components/admin/reddit-signals-client.tsx` | Badge, filter, CTA |
| `lib/admin/research/reddit-reply-draft*.ts` | Enqueue / map / schema |
| `app/api/admin/research/reddit-signals/[signalId]/reply-draft/route.ts` | API |
| `components/admin/reddit-reply-draft-panel.tsx` | UI |
| `workflows/n8n/reddit-reply-worth*.ts` | Klassifisering |
| `workflows/n8n/reddit-reply-draft*.ts` | Utkast |
| `docs/n8n/reddit-reply-worth-contract.md` | Kontrakt |
| `docs/n8n/reddit-reply-draft-contract.md` | Kontrakt |
| `docs/agents/reference.md` / `AGENTS.md` | Agent-regler |

---

## Rekkefølge for implementering

1. Fase 1 (score + UI) — **start her**; lever verdi uten draft.
2. Mathias/Coolify Expert: apply migrasjon.
3. n8n workflow deploy (eier-prosess) + verifiser scorer i admin.
4. Fase 2 (draft) når score-køen fungerer.
5. Fase 3 learning når dere har 20+ manuelle «ja/nei» på forslag.

---

## Åpne beslutninger (låst i denne planen med default)

| Spørsmål | Default i planen |
|----------|------------------|
| Terskel for «Verdt å svare» | `reply_worth >= 4` |
| Selftext i klassifisering | Nei i fase 1; valgfritt 1.5 |
| Soft link | Kun i én av tre varianter |
| Ny status `svart` | Nei i v1; bruk `brukt` |
| Auto-post | Aldri i denne planen |

Hvis Mathias vil endre terskel eller tillate body i scoring før fase 2: oppdater denne filen, ikke stille avvik i koden.
