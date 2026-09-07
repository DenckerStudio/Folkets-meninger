-- Personal issue stances (enig / uenig / ikke interessert) replace per-sak For/Mot/Avstår voting in the product UI.
-- Legacy anonymous ballots in citizen_votes are preserved for historical alignment stats.

CREATE TABLE IF NOT EXISTS public.issue_stances (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  stance text NOT NULL CHECK (stance IN ('enig', 'uenig', 'ikke_interessert')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_stances_user ON public.issue_stances (user_id);
CREATE INDEX IF NOT EXISTS idx_issue_stances_issue ON public.issue_stances (stortinget_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_stances_stance ON public.issue_stances (stance);

ALTER TABLE public.issue_stances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_stances_select_own ON public.issue_stances;
CREATE POLICY issue_stances_select_own ON public.issue_stances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.issue_stances FROM anon, authenticated;
GRANT SELECT ON TABLE public.issue_stances TO authenticated;

CREATE OR REPLACE FUNCTION public.set_issue_stance(
  p_user_id uuid,
  p_issue_id text,
  p_stance text,
  p_title text DEFAULT NULL,
  p_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stance NOT IN ('enig', 'uenig', 'ikke_interessert') THEN
    RAISE EXCEPTION 'invalid stance: %', p_stance;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (p_issue_id, p_title, p_summary, now())
  ON CONFLICT (id) DO UPDATE SET
    title = COALESCE(EXCLUDED.title, public.stortinget_issues.title),
    summary = COALESCE(EXCLUDED.summary, public.stortinget_issues.summary),
    last_synced_at = now();

  INSERT INTO public.issue_stances (user_id, stortinget_issue_id, stance, updated_at)
  VALUES (p_user_id, p_issue_id, p_stance, now())
  ON CONFLICT (user_id, stortinget_issue_id) DO UPDATE SET
    stance = EXCLUDED.stance,
    updated_at = now();

  RETURN jsonb_build_object(
    'stance', p_stance,
    'updated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_on_issue(
  p_user_id uuid,
  p_issue_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object('hasStance', true, 'stance', s.stance, 'updated_at', s.updated_at)
      FROM public.issue_stances s
      WHERE s.user_id = p_user_id
        AND s.stortinget_issue_id = p_issue_id
    ),
    jsonb_build_object('hasStance', false, 'stance', null)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_history(p_user_id uuid)
RETURNS TABLE (
  stortinget_issue_id text,
  title text,
  stance text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.stortinget_issue_id,
    i.title,
    s.stance,
    s.updated_at
  FROM public.issue_stances s
  LEFT JOIN public.stortinget_issues i ON i.id = s.stortinget_issue_id
  WHERE s.user_id = p_user_id
  ORDER BY s.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.issue_stances
  WHERE user_id = p_user_id
    AND stance IN ('enig', 'uenig');
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_signals(p_user_id uuid, p_limit integer DEFAULT 6)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH engaged AS (
    SELECT
      i.category,
      unnest(COALESCE(i.ai_labels, ARRAY[]::text[])) AS label
    FROM public.issue_stances s
    JOIN public.stortinget_issues i ON i.id = s.stortinget_issue_id
    WHERE s.user_id = p_user_id
      AND s.stance IN ('enig', 'uenig')
  ),
  category_counts AS (
    SELECT category AS value, count(*)::integer AS count
    FROM engaged
    WHERE category IS NOT NULL AND btrim(category) <> ''
    GROUP BY category
    ORDER BY count DESC, category ASC
    LIMIT p_limit
  ),
  label_counts AS (
    SELECT label AS value, count(*)::integer AS count
    FROM engaged
    WHERE label IS NOT NULL AND btrim(label) <> ''
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM category_counts), '[]'::jsonb),
    'labels', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM label_counts), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.set_issue_stance(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stance_on_issue(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stance_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stance_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stance_signals(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_issue_stance(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_stance_on_issue(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_stance_history(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_stance_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_stance_signals(uuid, integer) TO service_role;
