-- Stop copying kostnad into how_affected when how_affected is empty (R4).
-- Add forslag jsonb for numbered proposal lists (n8n p_forslag).

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS forslag jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'issue_ai_summaries_forslag_array'
      AND conrelid = 'public.issue_ai_summaries'::regclass
  ) THEN
    ALTER TABLE public.issue_ai_summaries
      ADD CONSTRAINT issue_ai_summaries_forslag_array
      CHECK (forslag IS NULL OR jsonb_typeof(forslag) = 'array');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(text, text, text, text, text, text, text, jsonb, text[]);

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text,
  p_narrative text DEFAULT NULL,
  p_who_affected text DEFAULT NULL,
  p_how_affected text DEFAULT NULL,
  p_topic_cards jsonb DEFAULT '[]'::jsonb,
  p_labels text[] DEFAULT '{}'::text[],
  p_forslag jsonb DEFAULT NULL
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
  v_how text := nullif(trim(p_how_affected), '');
  v_labels text[] := coalesce(p_labels, '{}'::text[]);
  v_forslag_insert jsonb;
BEGIN
  IF p_forslag IS NOT NULL AND jsonb_typeof(p_forslag) <> 'array' THEN
    RAISE EXCEPTION 'p_forslag must be a JSON array or NULL';
  END IF;

  v_forslag_insert := CASE WHEN p_forslag IS NULL THEN '[]'::jsonb ELSE p_forslag END;

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
    forslag,
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
    v_forslag_insert,
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
    forslag = CASE
      WHEN p_forslag IS NULL THEN public.issue_ai_summaries.forslag
      ELSE EXCLUDED.forslag
    END,
    updated_at = now();

  UPDATE public.stortinget_issues
  SET ai_labels = v_labels
  WHERE id = p_issue_id;

  RETURN jsonb_build_object('ok', true, 'stortinget_issue_id', p_issue_id);
END;
$$;

-- Backfill: RPC fallback previously copied kostnad into how_affected (idempotent).
UPDATE public.issue_ai_summaries
SET how_affected = NULL
WHERE how_affected IS NOT NULL
  AND kostnad IS NOT NULL
  AND btrim(how_affected) = btrim(kostnad);

REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text, text, text, text, jsonb, text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text, text, text, text, jsonb, text[], jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
