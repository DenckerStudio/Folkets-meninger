-- Docling ingest RPC (n8n) + bge-m3 embedding_v2 backfill RPCs.
-- Builds on 20261019200000 (embedding_v2), 20261019203000 (chunk metadata), 20261019210000 (hearings).

BEGIN;

-- ---------------------------------------------------------------------------
-- Sak documents: Docling markdown ingest columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.stortinget_issue_documents
  ADD COLUMN IF NOT EXISTS content_markdown text,
  ADD COLUMN IF NOT EXISTS markdown_source text,
  ADD COLUMN IF NOT EXISTS page_count int,
  ADD COLUMN IF NOT EXISTS ingest_version text,
  ADD COLUMN IF NOT EXISTS chunker text,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- ---------------------------------------------------------------------------
-- Hearings: optional alias columns for n8n/docling payloads (P9 base from 19210000)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stortinget_hearings
  ADD COLUMN IF NOT EXISTS komite text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS raw jsonb,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

ALTER TABLE public.hearing_documents
  ADD COLUMN IF NOT EXISTS document_kind text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS content_markdown text,
  ADD COLUMN IF NOT EXISTS page_count int,
  ADD COLUMN IF NOT EXISTS ingest_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS chunks_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

-- ---------------------------------------------------------------------------
-- embedding_v2 bookkeeping (19200000 adds embedding_v2 + embedding_model)
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2_model text,
  ADD COLUMN IF NOT EXISTS embedding_v2_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_v2_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_v2_attempts int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.document_chunks.embedding_v2_status IS
  'pending | ready | failed — bge-m3 backfill; skip listing after 3 failed attempts';

-- Hearing chunks may carry optional issue_id for v2 match / filters (P9 allowed issue_id NULL only).
ALTER TABLE public.document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_sak_or_hearing_check;

ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_sak_or_hearing_check CHECK (
    (hearing_document_id IS NULL AND issue_id IS NOT NULL)
    OR (hearing_document_id IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- n8n_upsert_docling_document
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_upsert_docling_document(
  p_target text,
  p_doc jsonb,
  p_chunks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text := lower(btrim(coalesce(p_target, '')));
  v_issue_id text := nullif(btrim(coalesce(p_doc->>'issue_id', '')), '');
  v_document_id text := nullif(btrim(coalesce(p_doc->>'document_id', '')), '');
  v_hearing_id text := nullif(btrim(coalesce(p_doc->>'hearing_id', '')), '');
  v_content_hash text := nullif(btrim(coalesce(p_doc->>'content_hash', '')), '');
  v_content_markdown text := nullif(p_doc->>'content_markdown', '');
  v_ingest_status text;
  v_chunk_count int;
  v_existing_hash text;
  v_hearing_doc_id uuid;
  v_inserted int := 0;
  v_chunk jsonb;
  v_idx int;
  v_meta jsonb;
  v_section_title text;
  v_heading_path text;
  v_page int;
  v_page_start int;
  v_page_end int;
BEGIN
  IF v_target NOT IN ('sak', 'horing') THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'invalid_target');
  END IF;

  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'missing_document_id');
  END IF;

  IF p_chunks IS NULL OR jsonb_typeof(p_chunks) <> 'array' THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'chunks_must_be_array');
  END IF;

  v_chunk_count := jsonb_array_length(p_chunks);
  IF v_chunk_count > 2000 THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'too_many_chunks');
  END IF;

  v_ingest_status := CASE
    WHEN coalesce(btrim(v_content_markdown), '') <> '' THEN 'converted'
    ELSE coalesce(nullif(btrim(coalesce(p_doc->>'ingest_status', '')), ''), 'pending')
  END;

  IF v_target = 'sak' THEN
    IF v_issue_id IS NULL THEN
      RETURN jsonb_build_object('status', 'error', 'error', 'missing_issue_id');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.stortinget_issues i WHERE i.id = v_issue_id) THEN
      RETURN jsonb_build_object('status', 'skipped_no_issue');
    END IF;

    SELECT d.content_hash
    INTO v_existing_hash
    FROM public.stortinget_issue_documents d
    WHERE d.issue_id = v_issue_id
      AND d.document_id = v_document_id;

    IF v_content_hash IS NOT NULL
      AND v_existing_hash IS NOT NULL
      AND v_content_hash = v_existing_hash THEN
      RETURN jsonb_build_object(
        'status', 'unchanged',
        'document_id', v_document_id,
        'chunks', v_chunk_count
      );
    END IF;

    INSERT INTO public.stortinget_issue_documents (
      issue_id,
      document_id,
      title,
      document_type,
      source_url,
      content_hash,
      content_markdown,
      markdown_source,
      page_count,
      ingest_version,
      chunker,
      pdf_url,
      ingest_status,
      chunks_status,
      fetched_at
    )
    VALUES (
      v_issue_id,
      v_document_id,
      coalesce(nullif(btrim(coalesce(p_doc->>'title', '')), ''), 'Dokument'),
      coalesce(
        nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'document_type', '')), ''),
        'unknown'
      ),
      nullif(btrim(coalesce(p_doc->>'source_url', '')), ''),
      v_content_hash,
      v_content_markdown,
      nullif(btrim(coalesce(p_doc->>'markdown_source', '')), ''),
      (p_doc->>'page_count')::int,
      nullif(btrim(coalesce(p_doc->>'ingest_version', '')), ''),
      nullif(btrim(coalesce(p_doc->>'chunker', '')), ''),
      nullif(btrim(coalesce(p_doc->>'pdf_url', '')), ''),
      v_ingest_status,
      'pending',
      coalesce((p_doc->>'fetched_at')::timestamptz, now())
    )
    ON CONFLICT (issue_id, document_id) DO UPDATE SET
      title = EXCLUDED.title,
      document_type = EXCLUDED.document_type,
      source_url = coalesce(EXCLUDED.source_url, public.stortinget_issue_documents.source_url),
      content_hash = coalesce(EXCLUDED.content_hash, public.stortinget_issue_documents.content_hash),
      content_markdown = EXCLUDED.content_markdown,
      markdown_source = EXCLUDED.markdown_source,
      page_count = EXCLUDED.page_count,
      ingest_version = EXCLUDED.ingest_version,
      chunker = EXCLUDED.chunker,
      pdf_url = EXCLUDED.pdf_url,
      ingest_status = EXCLUDED.ingest_status,
      chunks_status = 'pending',
      fetched_at = EXCLUDED.fetched_at;

    DELETE FROM public.document_chunks c
    WHERE c.issue_id = v_issue_id
      AND c.document_id = v_document_id;

    FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
    LOOP
      v_idx := coalesce((v_chunk->>'chunk_index')::int, v_inserted);
      v_meta := coalesce(v_chunk->'metadata', '{}'::jsonb);

      v_heading_path := nullif(
        btrim(coalesce(v_meta->>'heading_path', v_chunk->>'heading_path', '')),
        ''
      );
      v_section_title := nullif(
        btrim(coalesce(v_meta->>'section_title', v_chunk->>'section_title', v_heading_path, '')),
        ''
      );

      v_page_start := coalesce(
        nullif(v_meta->>'page_start', '')::int,
        nullif(v_chunk->>'page_start', '')::int
      );
      v_page_end := coalesce(
        nullif(v_meta->>'page_end', '')::int,
        nullif(v_chunk->>'page_end', '')::int
      );
      v_page := coalesce(
        nullif(v_meta->>'page', '')::int,
        nullif(v_chunk->>'page', '')::int,
        v_page_start
      );

      v_meta := v_meta
        || jsonb_strip_nulls(jsonb_build_object(
          'issue_id', v_issue_id,
          'document_id', v_document_id,
          'content_hash', coalesce(v_chunk->>'content_hash', v_content_hash),
          'section_title', v_section_title,
          'heading_path', coalesce(v_heading_path, v_section_title),
          'page', v_page,
          'page_start', v_page_start,
          'page_end', coalesce(v_page_end, v_page_start, v_page)
        ));

      INSERT INTO public.document_chunks (
        issue_id,
        document_id,
        chunk_index,
        content,
        embedding_status,
        embedding_v2_status,
        metadata
      )
      VALUES (
        v_issue_id,
        v_document_id,
        v_idx,
        coalesce(v_chunk->>'content', ''),
        'pending',
        'pending',
        v_meta
      );
      v_inserted := v_inserted + 1;
    END LOOP;

    RETURN jsonb_build_object(
      'status', 'upserted',
      'document_id', v_document_id,
      'chunks', v_inserted
    );
  END IF;

  -- p_target = 'horing'
  IF v_hearing_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'missing_hearing_id');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stortinget_hearings h WHERE h.id = v_hearing_id) THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'missing_hearing');
  END IF;

  IF v_issue_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.stortinget_issues i WHERE i.id = v_issue_id) THEN
    RETURN jsonb_build_object('status', 'skipped_no_issue');
  END IF;

  SELECT d.content_hash, d.id
  INTO v_existing_hash, v_hearing_doc_id
  FROM public.hearing_documents d
  WHERE d.hearing_id = v_hearing_id
    AND d.external_key = v_document_id;

  IF v_content_hash IS NOT NULL
    AND v_existing_hash IS NOT NULL
    AND v_content_hash = v_existing_hash THEN
    RETURN jsonb_build_object(
      'status', 'unchanged',
      'document_id', v_document_id,
      'chunks', v_chunk_count
    );
  END IF;

  INSERT INTO public.hearing_documents (
    hearing_id,
    external_key,
    title,
    kind,
    document_kind,
    source_url,
    pdf_url,
    markdown,
    content_markdown,
    content_hash,
    page_count,
    ingest_status,
    chunks_status,
    status,
    fetched_at,
    updated_at
  )
  VALUES (
    v_hearing_id,
    v_document_id,
    coalesce(nullif(btrim(coalesce(p_doc->>'title', '')), ''), 'Dokument'),
    coalesce(nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'kind', '')), ''), 'unknown'),
    coalesce(nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'kind', '')), ''), 'unknown'),
    nullif(btrim(coalesce(p_doc->>'source_url', '')), ''),
    nullif(btrim(coalesce(p_doc->>'pdf_url', '')), ''),
    v_content_markdown,
    v_content_markdown,
    v_content_hash,
    (p_doc->>'page_count')::int,
    v_ingest_status,
    'pending',
    'converted',
    coalesce((p_doc->>'fetched_at')::timestamptz, now()),
    now()
  )
  ON CONFLICT (hearing_id, external_key) DO UPDATE SET
    title = EXCLUDED.title,
    kind = EXCLUDED.kind,
    document_kind = EXCLUDED.document_kind,
    source_url = coalesce(EXCLUDED.source_url, public.hearing_documents.source_url),
    pdf_url = EXCLUDED.pdf_url,
    markdown = EXCLUDED.markdown,
    content_markdown = EXCLUDED.content_markdown,
    content_hash = EXCLUDED.content_hash,
    page_count = EXCLUDED.page_count,
    ingest_status = EXCLUDED.ingest_status,
    chunks_status = 'pending',
    status = 'converted',
    fetched_at = EXCLUDED.fetched_at,
    updated_at = now()
  RETURNING id INTO v_hearing_doc_id;

  DELETE FROM public.document_chunks c
  WHERE c.hearing_document_id = v_hearing_doc_id;

  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
  LOOP
    v_idx := coalesce((v_chunk->>'chunk_index')::int, v_inserted);
    v_meta := coalesce(v_chunk->'metadata', '{}'::jsonb);

    v_heading_path := nullif(
      btrim(coalesce(v_meta->>'heading_path', v_chunk->>'heading_path', '')),
      ''
    );
    v_section_title := nullif(
      btrim(coalesce(v_meta->>'section_title', v_chunk->>'section_title', v_heading_path, '')),
      ''
    );

    v_page_start := coalesce(
      nullif(v_meta->>'page_start', '')::int,
      nullif(v_chunk->>'page_start', '')::int
    );
    v_page_end := coalesce(
      nullif(v_meta->>'page_end', '')::int,
      nullif(v_chunk->>'page_end', '')::int
    );
    v_page := coalesce(
      nullif(v_meta->>'page', '')::int,
      nullif(v_chunk->>'page', '')::int,
      v_page_start
    );

    v_meta := v_meta
      || jsonb_strip_nulls(jsonb_build_object(
        'hearing_id', v_hearing_id,
        'issue_id', v_issue_id,
        'document_id', v_document_id,
        'content_hash', coalesce(v_chunk->>'content_hash', v_content_hash),
        'section_title', v_section_title,
        'heading_path', coalesce(v_heading_path, v_section_title),
        'page', v_page,
        'page_start', v_page_start,
        'page_end', coalesce(v_page_end, v_page_start, v_page)
      ));

    INSERT INTO public.document_chunks (
      hearing_id,
      hearing_document_id,
      issue_id,
      document_id,
      chunk_index,
      content,
      embedding_status,
      embedding_v2_status,
      metadata
    )
    VALUES (
      v_hearing_id,
      v_hearing_doc_id,
      v_issue_id,
      v_document_id,
      v_idx,
      coalesce(v_chunk->>'content', ''),
      'pending',
      'pending',
      v_meta
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'upserted',
    'document_id', v_document_id,
    'chunks', v_inserted
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- embedding_v2 backfill (bge-m3 / 1024-dim)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_chunks_missing_v2(int);

CREATE OR REPLACE FUNCTION public.list_chunks_missing_v2(
  p_limit int DEFAULT 16,
  p_issue_id text DEFAULT NULL,
  p_hearing_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.content
  FROM public.document_chunks c
  WHERE c.embedding_v2 IS NULL
    AND coalesce(c.embedding_v2_status, 'pending') = 'pending'
    AND c.embedding_v2_attempts < 3
    AND coalesce(btrim(c.content), '') <> ''
    AND (
      nullif(btrim(coalesce(p_issue_id, '')), '') IS NULL
      OR c.issue_id = nullif(btrim(p_issue_id), '')
    )
    AND (
      nullif(btrim(coalesce(p_hearing_id, '')), '') IS NULL
      OR c.hearing_id = nullif(btrim(p_hearing_id), '')
    )
  ORDER BY c.id ASC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 16), 256));
$$;

DROP FUNCTION IF EXISTS public.save_embeddings_v2(jsonb, text);

CREATE OR REPLACE FUNCTION public.save_embeddings_v2(p_rows jsonb, p_model text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_id uuid;
  v_emb vector(1024);
  v_dims int;
  v_saved int := 0;
  v_failed int := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_id := (v_row->>'id')::uuid;
    IF v_id IS NULL THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_emb := (v_row->>'embedding')::vector(1024);
      v_dims := vector_dims(v_emb);
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.document_chunks c
        SET
          embedding_v2_attempts = c.embedding_v2_attempts + 1,
          embedding_v2_status = CASE
            WHEN c.embedding_v2_attempts + 1 >= 3 THEN 'failed'
            ELSE 'pending'
          END
        WHERE c.id = v_id;
        v_failed := v_failed + 1;
        CONTINUE;
    END;

    IF v_dims IS DISTINCT FROM 1024 THEN
      UPDATE public.document_chunks c
      SET
        embedding_v2_attempts = c.embedding_v2_attempts + 1,
        embedding_v2_status = CASE
          WHEN c.embedding_v2_attempts + 1 >= 3 THEN 'failed'
          ELSE 'pending'
        END
      WHERE c.id = v_id;
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    UPDATE public.document_chunks c
    SET
      embedding_v2 = v_emb,
      embedding_v2_model = nullif(btrim(coalesce(p_model, '')), ''),
      embedding_v2_at = now(),
      embedding_v2_status = 'ready'
    WHERE c.id = v_id;

    IF FOUND THEN
      v_saved := v_saved + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'failed', v_failed);
END;
$$;

DROP FUNCTION IF EXISTS public.match_document_chunks_v2(vector, int, text[]);

CREATE OR REPLACE FUNCTION public.match_document_chunks_v2(
  query_embedding vector(1024),
  match_count int DEFAULT 8,
  filter_issue_ids text[] DEFAULT NULL,
  filter_hearing_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  issue_id text,
  hearing_id text,
  document_id text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    dc.id,
    dc.issue_id,
    dc.hearing_id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    (1 - (dc.embedding_v2 <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  WHERE dc.embedding_v2 IS NOT NULL
    AND (dc.issue_id IS NOT NULL OR dc.hearing_id IS NOT NULL)
    AND (
      filter_issue_ids IS NULL
      OR cardinality(filter_issue_ids) = 0
      OR dc.issue_id = ANY (filter_issue_ids)
    )
    AND (
      nullif(btrim(coalesce(filter_hearing_id, '')), '') IS NULL
      OR dc.hearing_id = nullif(btrim(filter_hearing_id), '')
    )
  ORDER BY dc.embedding_v2 <=> query_embedding
  LIMIT GREATEST(coalesce(match_count, 8), 1);
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_docling_document(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_chunks_missing_v2(int, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_embeddings_v2(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_document_chunks_v2(vector, int, text[], text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_docling_document(text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_chunks_missing_v2(int, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_embeddings_v2(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_document_chunks_v2(vector, int, text[], text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
