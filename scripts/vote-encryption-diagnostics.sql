-- Read-only diagnostics for Coolify / psql (do not paste secrets into tickets).
-- Run as a role that can read private.app_settings and execute decrypt RPCs.

-- 1) Which pepper sources exist (lengths only)
SELECT
  key,
  length(trim(coalesce(value, ''))) AS value_len,
  trim(coalesce(value, '')) = '' AS is_blank
FROM private.app_settings
WHERE key IN ('vote_encryption_secret', 'vote_encryption_legacy_pepper')
ORDER BY key;

-- 2) Current vote_encryption_key / decrypt implementation (check hardcoded fallback string in function body)
SELECT pg_get_functiondef('public.vote_encryption_key(uuid)'::regprocedure);

-- 3) Receipt volume
SELECT
  (SELECT count(*) FROM public.user_vote_receipts) AS user_vote_receipts,
  (SELECT count(*) FROM public.poll_vote_receipts) AS poll_vote_receipts;

-- 4) Per-receipt decrypt via RPC (replace UUIDs with sample user_id from receipts)
-- SELECT r.user_id, r.stortinget_issue_id,
--        public.get_user_vote_on_issue(r.user_id, r.stortinget_issue_id) AS decrypted
-- FROM public.user_vote_receipts r
-- LIMIT 5;
