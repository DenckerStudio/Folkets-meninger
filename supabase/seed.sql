-- Local Supabase seed (runs after migrations on `supabase db reset`).
-- Safe to re-run: uses ON CONFLICT / idempotent inserts.

-- Voting pepper (required for cast_vote). Dev-only value — rotate for any shared env.
INSERT INTO private.app_settings (key, value)
VALUES (
  'vote_encryption_secret',
  'local-dev-vote-pepper-folkets-stemme-change-in-production'
)
ON CONFLICT (key) DO UPDATE
SET value = excluded.value,
    updated_at = now();

-- Minimal sak cache row so voting/UI can be exercised without Stortinget sync.
INSERT INTO public.stortinget_issues (
  id,
  title,
  summary,
  status,
  last_synced_at,
  ferdigbehandlet,
  sak_kind,
  category
)
VALUES (
  'local-demo-sak',
  'Demo-sak (lokal Supabase)',
  'Plassholder for lokal utvikling og Playwright. Erstattes av cron/sync mot Stortinget i test/prod.',
  'open',
  now(),
  false,
  'lovforslag',
  'Demo'
)
ON CONFLICT (id) DO UPDATE
SET
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  last_synced_at = excluded.last_synced_at,
  ferdigbehandlet = excluded.ferdigbehandlet;
