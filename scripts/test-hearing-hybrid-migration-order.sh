#!/usr/bin/env bash
# Apply 20261019200000 (#179) then 20261019210000 (#178) on a fresh Supabase local DB.
# Requires Docker and Supabase CLI (same as CI db-security).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "test-hearing-hybrid-migration-order: docker not available; skip" >&2
  exit 0
fi

if ! command -v supabase >/dev/null 2>&1; then
  npx -y supabase@2.121.0 db start
  SUPABASE_BIN="npx -y supabase@2.121.0"
else
  supabase db start
  SUPABASE_BIN="supabase"
fi

# Full reset applies every migration in supabase/migrations/ in filename order.
$SUPABASE_BIN db reset --no-seed

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT proname,
         pg_get_function_result(p.oid) AS result_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND proname = 'search_chunks_hybrid';
" | tee /tmp/search_chunks_hybrid-after-reset.txt

# Hearing return columns must exist on the function result (via a probe call).
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT hearing_id, hearing_document_id
  FROM public.search_chunks_hybrid('test', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '1', 1)
  LIMIT 0;
"

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT to_regclass('public.stortinget_hearings') IS NOT NULL AS hearings_table,
         to_regclass('public.hearing_documents') IS NOT NULL AS hearing_docs_table;
"

echo "test-hearing-hybrid-migration-order: ok"
