-- #241 del 2: fjern legacy jsonb-overloads for høring-sync (erstattet av explicit-arg RPC-er i 20261027150000).
-- Kjøres via Coolify Expert (backup + dry-run + apply) før merge til main.

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.n8n_upsert_stortinget_hearing(jsonb);
DROP FUNCTION IF EXISTS public.n8n_upsert_hearing_document(jsonb);

COMMIT;
