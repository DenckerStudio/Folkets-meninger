-- Godkjente AI-sammendrag per stortingssak (hva / hvem / kostnad)
create table if not exists public.issue_ai_summaries (
  stortinget_issue_id text primary key,
  hva text not null,
  hvem text not null,
  kostnad text not null,
  context_hash text not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issue_ai_summaries_approved_at_idx
  on public.issue_ai_summaries (approved_at desc);

alter table public.issue_ai_summaries enable row level security;

create policy "issue_ai_summaries_select_anon"
  on public.issue_ai_summaries
  for select
  to anon, authenticated
  using (true);

comment on table public.issue_ai_summaries is
  'Godkjente, validerte AI-sammendrag (hva/hvem/kostnad) per stortinget_issue_id';
