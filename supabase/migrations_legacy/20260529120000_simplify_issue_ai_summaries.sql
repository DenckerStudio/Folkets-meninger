-- AI summaries are generated only by n8n + Ollama; app reads issue_ai_summaries.

drop index if exists public.issue_ai_summaries_approved_at_idx;

alter table public.issue_ai_summaries
  drop column if exists context_hash,
  drop column if exists approved_at;

alter table public.stortinget_issues
  drop column if exists ai_summary_json,
  drop column if exists ai_summary_generated_at;

-- Legacy per-field / dynamic-card columns (not used by n8n hva/hvem/kostnad flow)
alter table public.issue_ai_summaries
  drop column if exists hva_approved_at,
  drop column if exists hvem_approved_at,
  drop column if exists kostnad_approved_at,
  drop column if exists cards_json,
  drop column if exists cards_approved_at;

comment on table public.issue_ai_summaries is
  'AI-sammendrag (hva/hvem/kostnad) per stortinget_issue_id, skrevet av n8n-workflow.';
