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
  if [[ "$base" == 202610221* ]]; then
    return 0
  fi
  if [[ "$base" == 202610261* ]]; then
    return 0
  fi
  if [[ "$base" == 20261027* ]]; then
    return 0
  fi
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

echo "Phase 4: RAG search stack (20261022100000–096000; 09* = CONCURRENTLY, no BEGIN) ..."
echo "  (prod may ship pg_trgm/unaccent without CREATE EXTENSION — migrations install into extensions schema)"
for f in $(ls -1 supabase/migrations/202610221*.sql | sort); do
  echo "  -> $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Phase 5a: embedding v2 queue transactional (26110100–26110400, 27090000, 27100000) ..."
for f in $(ls -1 supabase/migrations/20261026110[1-4]*.sql supabase/migrations/20261027*.sql 2>/dev/null | sort); do
  echo "  -> $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Phase 5b: embedding v2 pending partial index (26110000 CONCURRENTLY) ..."
if [[ -f supabase/migrations/20261026110000_document_chunks_v2_pending_issue_idx_concurrent.sql ]]; then
  export PGOPTIONS="${PGOPTIONS:--c lock_timeout=30s -c statement_timeout=0 -c maintenance_work_mem=256MB -c max_parallel_maintenance_workers=0}"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20261026110000_document_chunks_v2_pending_issue_idx_concurrent.sql
  unset PGOPTIONS
fi

echo "Running security-lockdown-defaults.sql (supabase_admin connection) ..."
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

echo "Running embedding_v2_claim_leases.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_v2_claim_leases.sql

echo "Running n8n_backfill_db_pressure.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/n8n_backfill_db_pressure.sql

echo "Running n8n_list_v2_priority_issues_batch_tiers.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/n8n_list_v2_priority_issues_batch_tiers.sql

echo "Running security-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-guard.sql

echo "Running security-jwt-smoke.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-jwt-smoke.sql

echo "Running rpc-caller-authz-runtime.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc-caller-authz-runtime.sql

echo "Running security-definer-caller-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-definer-caller-guard.sql

echo "=== Prod-like test OK ==="
