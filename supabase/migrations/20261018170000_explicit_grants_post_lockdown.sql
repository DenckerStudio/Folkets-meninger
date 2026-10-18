-- Idempotent grant repair for public objects that may be applied after
-- 20261018150000_security_lockdown_prod_safe.sql (default privileges no longer
-- grant anon/authenticated access). Payload schema is not exposed to anon.

DO $$
BEGIN
  IF to_regclass('public.opinion_innspill') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.opinion_innspill FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.opinion_innspill TO anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.opinion_innspill TO service_role';
  END IF;

  IF to_regclass('public.opinion_innspill_endorsements') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.opinion_innspill_endorsements FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.opinion_innspill_endorsements TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.opinion_innspill_endorsements TO service_role';
  END IF;

  IF to_regclass('public.site_feedback') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.site_feedback FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.site_feedback TO service_role';
  END IF;
END $$;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_opinion_innspill', 'endorse_opinion_innspill')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
