CREATE OR REPLACE FUNCTION public.n8n_blocking_poll_for_issue(p_issue_id text)
RETURNS TABLE (id uuid, track text, status text, created_at timestamptz, stortinget_issue_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.track, p.status, p.created_at, p.stortinget_issue_id
  FROM public.polls p
  WHERE p.stortinget_issue_id = btrim(p_issue_id)
    AND p.status IN ('draft', 'open', 'closed')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.n8n_blocking_poll_for_issue(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.n8n_blocking_poll_for_issue(text) TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_list_saks_without_blocking_poll(p_limit int DEFAULT 40, p_issue_id text DEFAULT NULL)
RETURNS TABLE (issue_id text, title text, summary text, category text, first_seen_at timestamptz, last_updated_at timestamptz, detail_json jsonb, documents json, ready_chunk_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.title, i.summary, i.category, i.first_seen_at, i.last_updated_at, i.detail_json,
    (SELECT COALESCE(json_agg(json_build_object('document_id', d.document_id, 'title', d.title, 'document_type', d.document_type, 'source_url', d.source_url, 'fetched_at', d.fetched_at) ORDER BY d.fetched_at DESC), '[]'::json) FROM (SELECT document_id, title, document_type, source_url, fetched_at FROM public.stortinget_issue_documents WHERE issue_id = i.id ORDER BY fetched_at DESC LIMIT 6) d),
    (SELECT dc.id FROM public.document_chunks dc WHERE dc.issue_id = i.id AND dc.embedding_status = 'ready' AND dc.embedding IS NOT NULL LIMIT 1)
  FROM public.stortinget_issues i
  WHERE EXISTS (SELECT 1 FROM public.document_chunks dc WHERE dc.issue_id = i.id AND dc.embedding_status = 'ready' AND dc.embedding IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.polls p WHERE p.stortinget_issue_id = i.id AND p.status IN ('draft', 'open', 'closed'))
    AND (NULLIF(trim(coalesce(p_issue_id, '')), '') IS NULL OR i.id = NULLIF(trim(p_issue_id), ''))
  ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 40), 50));
$$;
REVOKE ALL ON FUNCTION public.n8n_list_saks_without_blocking_poll(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.n8n_list_saks_without_blocking_poll(int, text) TO service_role;
