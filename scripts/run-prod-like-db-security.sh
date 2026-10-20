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

# Prod half-migrated: through 20150000, 21120000 (content_feedback) applied; 120000–130000 security chain pending.
DEFER_MIGRATIONS=(
  '20261020120000_rpc_caller_user_binding.sql'
  '20261020120001_revoke_impersonation_rpc_execute.sql'
  '20261020120002_reapply_rpc_execute_lockdown.sql'
  '20261020130000_api_rate_limit.sql'
)

# Must run after 120000 so caller helpers are not overwritten by the older binding migration.
POST_DEFER_MIGRATIONS=(
  '20261021160000_defense_in_depth_rpc_authz.sql'
)

should_skip() {
  local base="$1"
  local s
  for s in "${SKIP_MIGRATIONS[@]}"; do
    if [[ "$base" == "$s" ]]; then
      return 0
    fi
  done
  return 1
}

should_defer() {
  local base="$1"
  local d
  for d in "${DEFER_MIGRATIONS[@]}" "${POST_DEFER_MIGRATIONS[@]}"; do
    if [[ "$base" == "$d" ]]; then
      return 0
    fi
  done
  return 1
}

echo "Phase 1: migrations through 110001 (defer 120000+) ..."
for f in $(ls -1 supabase/migrations/*.sql | sort); do
  base=$(basename "$f")
  if should_skip "$base"; then
    echo "  -> SKIP $base"
    continue
  fi
  if should_defer "$base"; then
    echo "  -> DEFER $base"
    continue
  fi
  if [[ "$base" == '20261021120000_content_feedback.sql' ]]; then
    echo "  -> CI prep: pgvector i public (før content_feedback) ..."
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/ci-ensure-pgvector-public.sql
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

echo "Prod hotfix REVOKEs (manual on prod) ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/hotfix/20261019_revoke_impersonation.sql

if [[ -f supabase/migrations/20261018160000_security_lockdown_n8n.sql ]]; then
  echo "Applying 20261018160000_security_lockdown_n8n.sql ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261018160000_security_lockdown_n8n.sql
fi

if [[ -f supabase/migrations/20261020140000_n8n_rpc_anon_lockdown.sql ]]; then
  echo "Applying 20261020140000_n8n_rpc_anon_lockdown.sql ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261020140000_n8n_rpc_anon_lockdown.sql
fi

echo "Prod drift seed (record_political_consent default) before 120000 ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/prod-half-migrated-120000-seed.sql

echo "Phase 2: deferred security migrations 120000–130000 ..."
for d in "${DEFER_MIGRATIONS[@]}"; do
  echo "  -> $d"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "supabase/migrations/$d"
done

echo "Re-apply RPC lockdown (150000 re-grants authenticated EXECUTE on user-bound RPCs) ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261020120002_reapply_rpc_execute_lockdown.sql

echo "Phase 3: defense-in-depth RPC authz (after 120000 binding; must follow 20150000/21120000 from phase 1) ..."
for d in "${POST_DEFER_MIGRATIONS[@]}"; do
  echo "  -> $d"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "supabase/migrations/$d"
done

echo "Running security-lockdown-defaults.sql (supabase_admin connection) ..."
psql "$DEFAULTS_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-lockdown-defaults.sql

echo "Running action_capture_rpcs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/action_capture_rpcs.sql

echo "Running action_capture_atomic.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/action_capture_atomic.sql

echo "Running content_feedback_rpcs.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/content_feedback_rpcs.sql

echo "Running security-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-guard.sql

echo "Running security-jwt-smoke.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-jwt-smoke.sql

echo "Running rpc-caller-authz-runtime.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc-caller-authz-runtime.sql

echo "Running security-definer-caller-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-definer-caller-guard.sql

echo "=== Prod-like test OK ==="
