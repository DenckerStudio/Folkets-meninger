#!/usr/bin/env bash
# Prod-lignende verifisering: ingen 140000/160000, dropp drift-tabeller før 150000.
set -euo pipefail

LOG="${LOG:-/opt/cursor/artifacts/db-security-prod-like.log}"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54330/postgres}"
DEFAULTS_URL="${DEFAULTS_URL:-postgresql://supabase_admin:postgres@127.0.0.1:54330/postgres}"

exec > >(tee "$LOG") 2>&1

echo "=== Prod-like db-security test ==="
echo "DB_URL=$DB_URL"
echo "DEFAULTS_URL=$DEFAULTS_URL"

SKIP_MIGRATIONS=(
  '20261018140000_security_lockdown.sql'
  '20261018150000_security_lockdown_prod_safe.sql'
  '20261018160000_security_lockdown_n8n.sql'
)

echo "Applying migrations (excluding 140000, 150000, 160000) ..."
for f in $(ls -1 supabase/migrations/*.sql | sort); do
  base=$(basename "$f")
  skip=false
  for s in "${SKIP_MIGRATIONS[@]}"; do
    if [[ "$base" == "$s" ]]; then
      skip=true
      break
    fi
  done
  if $skip; then
    echo "  -> SKIP $base"
    continue
  fi
  echo "  -> $base"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Dropping prod-drift tables before 150000 ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DROP TABLE IF EXISTS public.opinion_innspill_endorsements CASCADE;
DROP TABLE IF EXISTS public.opinion_innspill CASCADE;
DROP TABLE IF EXISTS public.site_feedback CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
SQL

echo "Applying 20261018150000_security_lockdown_prod_safe.sql (postgres) ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261018150000_security_lockdown_prod_safe.sql

echo "Re-apply RPC lockdown (150000 re-grants authenticated EXECUTE on user-bound RPCs) ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261020120002_reapply_rpc_execute_lockdown.sql

echo "Running security-lockdown-defaults.sql (supabase_admin connection) ..."
psql "$DEFAULTS_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-lockdown-defaults.sql

echo "Running security-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-guard.sql

echo "Running security-jwt-smoke.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-jwt-smoke.sql

echo "=== Prod-like test OK ==="
