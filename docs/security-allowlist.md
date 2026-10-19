# Sikkerhets-allowlist (Postgres / Supabase)

Kilde for låsing: `supabase/migrations/20261018150000_security_lockdown_prod_safe.sql`.  
Oppdater denne filen og migrasjonen sammen når nye `rpc` / tabell-skriv legges til.

## Nye migrasjoner (etter lockdown)

`security-lockdown-defaults.sql` + migrasjon `150000` fjerner default `GRANT` til `anon` /
`authenticated` på nye objekter i `public`. **Hver ny migrasjon** som oppretter tabeller eller
RPC-er i `public` må inkludere eksplisitte `GRANT` som matcher RLS (minst privilegium) og
`GRANT EXECUTE` på RPC-er klienten kaller via PostgREST. Ikke gi `anon` tilgang til
`payload`-skjemaet (Payload bruker egen DB-rolle). CI `migration-sql-lint` advarer når
`CREATE TABLE` / `CREATE FUNCTION` i `public` mangler matchende `GRANT` i samme fil.

Generer hint fra kode: `node scripts/build-security-allowlist.mjs` (heuristikk — ikke autoritativ).

## RPC `EXECUTE` — `anon`

| Funksjon | Klient i app | Merknad |
|----------|--------------|---------|
| `get_public_user_displays` | `getAnonSupabase` / session | Offentlige visningsnavn |
| `get_issue_vote_totals` | anon / session | Aggregater |
| `get_poll_totals` | anon (`lib/polls/service.ts`) | Ja/nei/blank-telling |
| `get_poll_totals_by_fylke` | anon | Fylke-breakdown |
| `match_issue_document_chunks` | session / anon | RAG (Stemme+ / chat) |
| `get_prompt_results` | legacy | Forum-prompt, hvis tabell finnes |

## RPC `EXECUTE` — `authenticated` (inkl. anon-listen over)

| Funksjon | Klient | Merknad |
|----------|--------|---------|
| `is_admin` | session | RLS-policyer |
| `user_has_public_identity` | RLS / RPC | UGC-gating |
| `cast_vote` | JWT-test / PostgREST | App bruker ofte `service_role` via API |
| `cast_poll_vote` | JWT-test / API | |
| `get_user_vote_on_issue` | API | |
| `get_user_poll_vote` | API | |
| `get_user_vote_history` | API | |
| `set_issue_stance` | API (`/api/stance`) | |
| `get_user_stance_*` | API | |
| `update_user_profile_names` | API (`/api/user/profile`) | |
| `create_citizen_opinion` | API | |
| `create_citizen_opinion_reply` | API | |
| `create_app_suggestion` | API | |
| `cast_app_suggestion_vote` | API | |
| `create_hearing_comment` | API | |
| `set_user_onboarding_state` | API | |
| `report_content` | API | |
| `create_opinion_innspill` / `endorse_opinion_innspill` | API | |
| `user_has_political_consent` / `record_*` / `withdraw_*` | API | Samtykke |
| `search_stortinget_issues_for_chat` | session RAG | |
| `search_issue_document_chunks_text` | session RAG | |

**Dynamisk:** Alle `public.*`-funksjoner som nevnes i `pg_policies.qual` / `with_check` for `anon` eller `authenticated` får `GRANT EXECUTE` i migrasjonen.

## RPC — kun `service_role`

Admin, n8n, Stemme+, app-fremtid-skriv, batch/intern:

`grant_stemme_plus*`, `revoke_stemme_plus*`, `list_stemme_plus_supporters`, `grant_app_role*`, `revoke_app_role*`, `list_app_admins`, `publish_poll`, `archive_poll`, `create_app_changelog_entry`, `delete_app_changelog_entry`, `list_app_changelog_entries`, `create_app_roadmap_item`, `delete_app_roadmap_item`, `list_app_roadmap_items`, `set_app_roadmap_item_status`, `set_app_suggestion_status`, `set_app_suggestion_voting`, `list_app_suggestions`, `list_voting_app_suggestions`, `n8n_*` (skriv/liste), `apply_verified_fylke_claim`, `award_user_points`, `ensure_public_user`, `get_stance_totals_batch`, `get_vote_totals_batch`, `mark_opinion_innspill_packaged`, `purge_political_processing_data`, `user_has_public_display_eligibility`, `reclaim_document_body_storage`, osv.

## Tabell-DML

Etter global `REVOKE` gjenopprettes **SELECT/INSERT/UPDATE/DELETE** fra eksisterende RLS-policies (`pg_policies`) for `anon` / `authenticated`.

Ekstra eksplisitt i migrasjonen: `app_changelog_entries` / `app_roadmap_items` kun `SELECT` for anon/authenticated.

**Beholdt uendret:** `user_badges_select_public`, `user_points_balances` offentlige policies (ingen stramming i låsemigrasjonen).

## RLS `FORCE`

- **FORCE** kun på `app_roles` og `user_roles`.
- Alle andre tabeller: `ENABLE ROW LEVEL SECURITY` uten `FORCE` (SDF eid av postgres kan skrive uten BYPASSRLS).
