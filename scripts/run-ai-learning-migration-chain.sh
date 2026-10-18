#!/usr/bin/env bash
# Idempotent re-apply of PR #171 AI-learning migrations (00000 → 00300).
set -euo pipefail

DB_URL="${DB_URL:?Set DB_URL}"

CHAIN=(
  20261020100000_ai_learning.sql
  20261020100100_ai_learning_n8n_grants.sql
  20261020100200_ai_learning_n8n_align.sql
  20261020100300_ai_learning_n8n_expert_feedback.sql
)

echo "=== AI-learning migration chain (idempotent re-apply) ==="
echo "DB_URL=$DB_URL"

for base in "${CHAIN[@]}"; do
  f="supabase/migrations/$base"
  echo "  -> $base"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "=== AI-learning chain OK ==="
