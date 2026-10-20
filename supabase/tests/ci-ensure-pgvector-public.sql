-- CI / lokal db-security: tidligere migrasjoner installerer vector uten WITH SCHEMA public.
-- Prod (supabase-folkets) forventes allerede ha vector i public — ikke bruk denne filen der.
DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname
  INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'vector';

  IF v_schema IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
    RETURN;
  END IF;

  IF v_schema IS DISTINCT FROM 'public' THEN
    ALTER EXTENSION vector SET SCHEMA public;
  END IF;
END $$;
