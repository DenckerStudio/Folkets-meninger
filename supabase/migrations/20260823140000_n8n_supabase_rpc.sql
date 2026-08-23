-- RPC helpers for n8n Supabase nodes (replaces direct Postgres executeQuery).

CREATE OR REPLACE FUNCTION public.n8n_finalize_document_embedding(
  p_issue_id text,
  p_document_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chunks_status text;
BEGIN
  IF coalesce(btrim(p_issue_id), '') = '' OR coalesce(btrim(p_document_id), '') = '' THEN
    RAISE EXCEPTION 'issue_id and document_id are required';
  END IF;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.issue_id = p_issue_id
        AND c.document_id = p_document_id
        AND c.embedding_status = 'pending'
    ) THEN 'pending'
    WHEN EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.issue_id = p_issue_id
        AND c.document_id = p_document_id
        AND c.embedding_status = 'ready'
    ) THEN 'ready'
    ELSE d.chunks_status
  END
  INTO v_chunks_status
  FROM public.stortinget_issue_documents d
  WHERE d.issue_id = p_issue_id
    AND d.document_id = p_document_id;

  UPDATE public.stortinget_issue_documents d
  SET chunks_status = coalesce(v_chunks_status, d.chunks_status),
      content_full_text = NULL,
      content_html = NULL
  WHERE d.issue_id = p_issue_id
    AND d.document_id = p_document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'issue_id', p_issue_id,
    'document_id', p_document_id,
    'chunks_status', v_chunks_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_issues_missing_ai_summary(p_limit integer DEFAULT 1)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'summary', i.summary,
    'detail_json', jsonb_strip_nulls(jsonb_build_object(
      'ferdigbehandlet', i.detail_json->'ferdigbehandlet',
      'status', i.detail_json->'status',
      'innstillingstekst', left(coalesce(i.detail_json->>'innstillingstekst', ''), 6000),
      'vedtakstekst', left(coalesce(i.detail_json->>'vedtakstekst', ''), 4000),
      'korttittel', i.detail_json->>'korttittel',
      'tittel', i.detail_json->>'tittel'
    )),
    'ai_summary_source_context', left(coalesce(i.ai_summary_source_context, ''), 12000),
    'documents', COALESCE(
      json_agg(
        json_build_object(
          'document_id', d.document_id,
          'title', d.title,
          'document_type', d.document_type,
          'text_excerpt', left(coalesce(d.text_excerpt, ''), 2000),
          'source_url', d.source_url
        )
        ORDER BY d.fetched_at DESC
      ) FILTER (WHERE d.document_id IS NOT NULL),
      '[]'::json
    ),
    'rag_chunks', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', dc.document_id,
            'chunk_index', dc.chunk_index,
            'content', left(dc.content, 1200)
          )
          ORDER BY dc.document_id, dc.chunk_index
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, chunk_index, content
        FROM public.document_chunks
        WHERE issue_id = i.id
          AND embedding_status = 'ready'
        ORDER BY document_id, chunk_index
        LIMIT 8
      ) dc
    )
  )
  FROM public.stortinget_issues i
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
  LEFT JOIN public.stortinget_issue_documents d ON d.issue_id = i.id
  WHERE s.stortinget_issue_id IS NULL
  GROUP BY i.id, i.title, i.summary, i.detail_json, i.ai_summary_source_context
  ORDER BY i.last_synced_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 1), 25));
$$;

CREATE OR REPLACE FUNCTION public.n8n_get_issue_ai_context(p_issue_id text)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'summary', i.summary,
    'detail_json', jsonb_strip_nulls(jsonb_build_object(
      'ferdigbehandlet', i.detail_json->'ferdigbehandlet',
      'status', i.detail_json->'status',
      'innstillingstekst', left(coalesce(i.detail_json->>'innstillingstekst', ''), 6000),
      'vedtakstekst', left(coalesce(i.detail_json->>'vedtakstekst', ''), 4000),
      'korttittel', i.detail_json->>'korttittel',
      'tittel', i.detail_json->>'tittel'
    )),
    'ai_summary_source_context', left(coalesce(i.ai_summary_source_context, ''), 12000),
    'documents', COALESCE(
      json_agg(
        json_build_object(
          'document_id', d.document_id,
          'title', d.title,
          'document_type', d.document_type,
          'text_excerpt', left(coalesce(d.text_excerpt, ''), 2000),
          'source_url', d.source_url
        )
        ORDER BY d.fetched_at DESC
      ) FILTER (WHERE d.document_id IS NOT NULL),
      '[]'::json
    ),
    'rag_chunks', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', dc.document_id,
            'chunk_index', dc.chunk_index,
            'content', left(dc.content, 1200)
          )
          ORDER BY dc.document_id, dc.chunk_index
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, chunk_index, content
        FROM public.document_chunks
        WHERE issue_id = i.id
          AND embedding_status = 'ready'
        ORDER BY document_id, chunk_index
        LIMIT 8
      ) dc
    )
  )
  FROM public.stortinget_issues i
  LEFT JOIN public.stortinget_issue_documents d ON d.issue_id = i.id
  WHERE i.id = p_issue_id
  GROUP BY i.id, i.title, i.summary, i.detail_json, i.ai_summary_source_context;
$$;

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue_id text := nullif(btrim(p_payload->>'issue_id'), '');
  v_labels text[];
BEGIN
  IF v_issue_id IS NULL THEN
    RAISE EXCEPTION 'issue_id is required';
  END IF;

  SELECT coalesce(array_agg(value), ARRAY[]::text[])
  INTO v_labels
  FROM jsonb_array_elements_text(coalesce(p_payload->'labels', '[]'::jsonb)) AS value;

  WITH ups AS (
    INSERT INTO public.issue_ai_summaries (
      stortinget_issue_id,
      narrative,
      who_affected,
      how_affected,
      topic_cards,
      labels,
      hva,
      hvem,
      kostnad,
      updated_at
    ) VALUES (
      v_issue_id,
      p_payload->>'narrative',
      p_payload->>'who_affected',
      p_payload->>'how_affected',
      coalesce(p_payload->'topic_cards', '[]'::jsonb),
      v_labels,
      p_payload->>'hva',
      p_payload->>'hvem',
      p_payload->>'kostnad',
      now()
    )
    ON CONFLICT (stortinget_issue_id) DO UPDATE SET
      narrative = EXCLUDED.narrative,
      who_affected = EXCLUDED.who_affected,
      how_affected = EXCLUDED.how_affected,
      topic_cards = EXCLUDED.topic_cards,
      labels = EXCLUDED.labels,
      hva = EXCLUDED.hva,
      hvem = EXCLUDED.hvem,
      kostnad = EXCLUDED.kostnad,
      updated_at = now()
    RETURNING stortinget_issue_id, labels
  )
  UPDATE public.stortinget_issues i
  SET ai_labels = ups.labels
  FROM ups
  WHERE i.id = ups.stortinget_issue_id;

  RETURN jsonb_build_object(
    'ok', true,
    'issue_id', v_issue_id,
    'labels', to_jsonb(v_labels)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_finalize_document_embedding(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_get_issue_ai_context(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_finalize_document_embedding(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_get_issue_ai_context(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(jsonb) TO service_role;
