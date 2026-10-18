# AI learning n8n RPC alignment (PR #171)

Source of truth for n8n: `ai-laering-fase0-n8n.md` (N8N Expert handoff, 2026-10-18).

## Intentional deviations (security or schema)

| Topic | n8n handoff | This PR |
|-------|-------------|---------|
| `admin_activate_prompt_version` | Not listed as n8n RPC | `GRANT EXECUTE` to **authenticated** only; revoked from `service_role` so n8n cannot activate prompts. |
| `n8n_get_active_prompt` | Single `p_workflow_key`; JSON shape with prompt fields only | Matches. Filters `node_key = 'system'` (same as prod genmeta `node_key`). Dropped optional `p_node_key` overload from the initial migration to avoid PostgREST ambiguity. |
| `n8n_list_eval_cases` | Active cases for workflow | Returns `SETOF ai_eval_cases` (full row). n8n can read `input` / `expected` / `id` from columns. |
| `n8n_ai_weekly_metrics` | `guard_hits_per_1000_words`, `baseline_4w` | Returned as JSON `null` until word-count baselines and 4-week rollups are implemented. |
| Eval seed | Active golden set | `origin=golden_draft`, `status=draft` until rebuilt from `n8n_get_issue_ai_summary_context`. |
| `n8n_upsert_issue_ai_summary` | Trigger on UPDATE | RPC sets `app.ai_feedback_skip=1`; logs `regenerated` / `source=n8n` with `generation_id` when text changes. |
| Eval seed `workflow_key` | Prod workflow keys | Golden set uses `sak_summary` (matches PR #162 eval harness naming). |

## PostgREST cache

Migrations `20261020100200` and `20261020100300` end with `NOTIFY pgrst, 'reload schema';` before `COMMIT`. Emergency rollback of the 12-arg upsert: `supabase/rollback/20261020100200_n8n_upsert_issue_ai_summary_9arg.sql`.

## Applied in `20261020100200_ai_learning_n8n_align.sql`

- `issue_ai_summaries.generation_metadata` + extended `n8n_upsert_issue_ai_summary` (12 args).
- Drops legacy `n8n_upsert_issue_ai_summary` 9-arg and 4-arg overloads and `n8n_record_eval_run(jsonb)`.
- Seeds 20 `ai_eval_cases` from PR #162 `evals/golden/saker.jsonl`.
