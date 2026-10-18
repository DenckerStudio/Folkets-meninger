-- Rollback helper if PR #171 migration 20261020100200 must be reverted in prod.
-- Run in a transaction after NOTIFY if needed. Does NOT remove ai_* tables or 12-arg columns.
-- Source: supabase/migrations/20260823210000_n8n_ai_summary_rich_context.sql (9-arg body).

BEGIN;

DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[], text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text,
  p_narrative text DEFAULT NULL,
  p_who_affected text DEFAULT NULL,
  p_how_affected text DEFAULT NULL,
  p_topic_cards jsonb DEFAULT '[]'::jsonb,
  p_labels text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hva text := coalesce(nullif(trim(p_hva), ''), nullif(trim(p_narrative), ''), '');
  v_hvem text := coalesce(nullif(trim(p_hvem), ''), nullif(trim(p_who_affected), ''), '');
  v_kostnad text := coalesce(nullif(trim(p_kostnad), ''), '');
  v_narrative text := coalesce(nullif(trim(p_narrative), ''), v_hva);
  v_who text := coalesce(nullif(trim(p_who_affected), ''), v_hvem);
  v_how text := coalesce(nullif(trim(p_how_affected), ''), v_kostnad);
  v_labels text[] := coalesce(p_labels, '{}'::text[]);
BEGIN
  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id,
    hva,
    hvem,
    kostnad,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    updated_at
  )
  VALUES (
    p_issue_id,
    v_hva,
    v_hvem,
    v_kostnad,
    v_narrative,
    v_who,
    v_how,
    coalesce(p_topic_cards, '[]'::jsonb),
    v_labels,
    now()
  )
  ON CONFLICT (stortinget_issue_id) DO UPDATE SET
    hva = EXCLUDED.hva,
    hvem = EXCLUDED.hvem,
    kostnad = EXCLUDED.kostnad,
    narrative = EXCLUDED.narrative,
    who_affected = EXCLUDED.who_affected,
    how_affected = EXCLUDED.how_affected,
    topic_cards = EXCLUDED.topic_cards,
    labels = EXCLUDED.labels,
    updated_at = now();

  UPDATE public.stortinget_issues
  SET ai_labels = v_labels
  WHERE id = p_issue_id;

  RETURN jsonb_build_object('ok', true, 'stortinget_issue_id', p_issue_id);
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[]
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
