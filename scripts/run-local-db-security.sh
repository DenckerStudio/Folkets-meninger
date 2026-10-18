#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54330/postgres}"

echo "Applying migrations to $DB_URL ..."
for f in $(ls -1 supabase/migrations/*.sql | sort); do
  echo "  -> $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Running security-lockdown-defaults.sql (supabase_admin) ..."
if [[ -z "${DEFAULTS_URL:-}" ]]; then
  DEFAULTS_URL="$(echo "$DB_URL" | sed 's#postgresql://postgres:#postgresql://supabase_admin:#')"
fi
psql "$DEFAULTS_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-lockdown-defaults.sql

echo "Running security-guard.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-guard.sql

echo "Running security-jwt-smoke.sql ..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security-jwt-smoke.sql

echo "OK"
