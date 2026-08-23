-- Richer AI-summary context for n8n: source text + document excerpts + chunks,
-- not the full detail_json blob (egress / PostgREST size). Upsert also writes v2 fields.

DROP FUNCTION IF EXISTS public.n8n_list_issues_missing_ai_summary(int);
DROP FUNCTION IF EXISTS public.n8n_get_issue_ai_summary_context(text);
DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(text, text, text, text);

CREATE OR REPLACE FUNCTION public.n8n_get_issue_ai_summary_context(p_issue_id text)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  last_synced_at timestamptz,
  detail_json jsonb,
  ai_summary_source_context text,
  documents json,
  document_chunks json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.title,
    i.summary,
    i.henvisning,
    i.last_synced_at,
    jsonb_strip_nulls(
      jsonb_build_object(
        'henvisning', i.henvisning,
        'ferdigbehandlet', i.detail_json->'ferdigbehandlet',
        'korttittel', i.detail_json->>'korttittel',
        'komite', i.detail_json->'komite',
        'innstillingstekst', left(coalesce(i.detail_json->>'innstillingstekst', ''), 8000),
        'kortvedtak', left(coalesce(i.detail_json->>'kortvedtak', ''), 4000),
        'vedtakstekst', left(coalesce(i.detail_json->>'vedtakstekst', ''), 4000),
        'parentestekst', left(coalesce(i.detail_json->>'parentestekst', ''), 2000)
      )
    ) AS detail_json,
    left(coalesce(i.ai_summary_source_context, ''), 24000) AS ai_summary_source_context,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', d.document_id,
            'title', d.title,
            'document_type', d.document_type,
            'text_excerpt', left(coalesce(d.text_excerpt, ''), 3000),
            'source_url', d.source_url
          )
          ORDER BY d.fetched_at DESC
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, title, document_type, text_excerpt, source_url, fetched_at
        FROM public.stortinget_issue_documents
        WHERE issue_id = i.id
        ORDER BY fetched_at DESC NULLS LAST
        LIMIT 6
      ) d
    ) AS documents,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', c.document_id,
            'chunk_index', c.chunk_index,
            'content', left(c.content, 1600)
          )
          ORDER BY c.chunk_index
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, chunk_index, content
        FROM public.document_chunks
        WHERE issue_id = i.id
          AND content IS NOT NULL
          AND length(trim(content)) > 40
        ORDER BY chunk_index
        LIMIT 16
      ) c
    ) AS document_chunks
  FROM public.stortinget_issues i
  WHERE i.id = p_issue_id;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_issues_missing_ai_summary(p_limit int DEFAULT 1)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  last_synced_at timestamptz,
  detail_json jsonb,
  ai_summary_source_context text,
  documents json,
  document_chunks json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ctx.id,
    ctx.title,
    ctx.summary,
    ctx.henvisning,
    ctx.last_synced_at,
    ctx.detail_json,
    ctx.ai_summary_source_context,
    ctx.documents,
    ctx.document_chunks
  FROM public.stortinget_issues i
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
  JOIN LATERAL public.n8n_get_issue_ai_summary_context(i.id) ctx ON true
  WHERE s.stortinget_issue_id IS NULL
  ORDER BY i.last_synced_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 1), 50));
$$;

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
SET search_path = public
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

REVOKE ALL ON FUNCTION public.n8n_get_issue_ai_summary_context(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text, text, text, text, jsonb, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_get_issue_ai_summary_context(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text, text, text, text, jsonb, text[]) TO service_role;

NOTIFY pgrst, 'reload schema';
