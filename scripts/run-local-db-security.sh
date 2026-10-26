#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54330/postgres}"

SKIP_MIGRATIONS=(
  '20261018140000_security_lockdown.sql'
  '20261018160000_security_lockdown_n8n.sql'
)

echo "Applying migrations to $DB_URL (skip 140000, 160000 — bruk run-prod-like-db-security.sh for prod-lignende) ..."
for f in $(ls -1 supabase/migrations/*.sql | sort); do
  base=$(basename "$f")
  skip=false
  for s in "${SKIP_MIGRATIONS[@]}"; do
    if [[ "$base" == "$s" ]]; then skip=true; break; fi
  done
  if $skip; then
    echo "  -> SKIP $base"
    continue
  fi
  if [[ "$base" == '20261021120000_content_feedback.sql' ]]; then
    echo "  -> CI prep: pgvector i public (før content_feedback) ..."
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/ci-ensure-pgvector-public.sql
  fi
  echo "  -> $base"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Running security-lockdown-defaults.sql (supabase_admin) ..."
DEFAULTS_URL="${DEFAULTS_URL:-postgresql://supabase_admin:postgres@127.0.0.1:54330/postgres}"
if [[ "$DB_URL" != *"@127.0.0.1:54330/"* ]]; then
  DEFAULTS_URL="$(echo "$DB_URL" | sed 's#postgresql://postgres:#postgresql://supabase_admin:#')"
fi
psql "$DEFAULTS_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-lockdown-defaults.sql

echo "Running action_capture_rpcs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/action_capture_rpcs.sql

echo "Running action_capture_atomic.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/action_capture_atomic.sql

echo "Running n8n_upsert_issue_ai_summary.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/n8n_upsert_issue_ai_summary.sql

echo "Running research_briefs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/research_briefs.sql

echo "Running content_feedback_rpcs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/content_feedback_rpcs.sql

echo "Running issue_ai_summary_regeneration.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/issue_ai_summary_regeneration.sql

echo "Running embedding_v2_queue_rpcs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_v2_queue_rpcs.sql

echo "Running embedding_backlog_health_explain.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_backlog_health_explain.sql

echo "Running security-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-guard.sql

echo "Running security-jwt-smoke.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-jwt-smoke.sql

echo "Running rpc-caller-authz-runtime.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc-caller-authz-runtime.sql

echo "Running security-definer-caller-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-definer-caller-guard.sql

echo "OK"
