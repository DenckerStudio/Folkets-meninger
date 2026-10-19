-- Docling ingest RPC (n8n) + bge-m3 embedding_v2 backfill RPCs.
-- Builds on 20261019200000 (embedding_v2), 20261019203000 (chunk metadata), 20261019210000 (hearings).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.stortinget_hearings') IS NULL THEN
    RAISE EXCEPTION
      'Migration 20261019220000 requires public.stortinget_hearings (apply PR #178 / 20261019210000 first).';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document_chunks'
      AND column_name = 'embedding_v2'
  ) THEN
    RAISE EXCEPTION
      'Migration 20261019220000 requires document_chunks.embedding_v2 (apply PR #179 / 20261019200000 first).';
  END IF;
END $$;

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
  ADD COLUMN IF NOT EXISTS chunker text,
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

-- ---------------------------------------------------------------------------
-- Doc/chunk payload validation (no writes — safe before upsert)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._n8n_docling_validate_doc(p_doc jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw text;
  v_num int;
BEGIN
  IF p_doc ? 'page_count' AND p_doc->>'page_count' IS NOT NULL THEN
    v_raw := btrim(p_doc->>'page_count');
    IF v_raw = '' OR v_raw !~ '^[0-9]{1,6}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'page_count');
    END IF;
    v_num := v_raw::int;
    IF v_num < 0 OR v_num > 100000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'page_count');
    END IF;
  END IF;

  IF p_doc ? 'fetched_at' THEN
    BEGIN
      PERFORM (p_doc->>'fetched_at')::timestamptz;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'fetched_at');
    END;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._n8n_docling_validate_chunks(p_chunks jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chunk jsonb;
  v_content text;
  v_raw text;
  v_idx int;
  v_seen int[] := '{}';
  v_meta jsonb;
BEGIN
  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
  LOOP
    v_content := coalesce(v_chunk->>'content', '');
    IF coalesce(btrim(v_content), '') = '' THEN
      CONTINUE;
    END IF;

    IF NOT (v_chunk ? 'chunk_index') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'chunk_index');
    END IF;

    v_raw := nullif(btrim(v_chunk->>'chunk_index'), '');
    IF v_raw IS NULL OR v_raw !~ '^[0-9]{1,4}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'chunk_index');
    END IF;
    v_idx := v_raw::int;
    IF v_idx >= 2000 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'chunk_index');
    END IF;

    IF v_idx = ANY (v_seen) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'chunk_index', 'reason', 'duplicate');
    END IF;
    v_seen := array_append(v_seen, v_idx);

    v_meta := coalesce(v_chunk->'metadata', '{}'::jsonb);

    IF v_chunk ? 'page_start' OR (v_meta ? 'page_start') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page_start', v_chunk->>'page_start', '')), '');
      IF v_raw IS NOT NULL AND v_raw !~ '^-?\d+$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'page_start');
      END IF;
    END IF;

    IF v_chunk ? 'page_end' OR (v_meta ? 'page_end') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page_end', v_chunk->>'page_end', '')), '');
      IF v_raw IS NOT NULL AND v_raw !~ '^-?\d+$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'page_end');
      END IF;
    END IF;

    IF v_chunk ? 'page' OR (v_meta ? 'page') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page', v_chunk->>'page', '')), '');
      IF v_raw IS NOT NULL AND v_raw !~ '^-?\d+$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_chunk', 'field', 'page');
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._n8n_docling_validate_doc(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._n8n_docling_validate_chunks(jsonb) FROM PUBLIC, anon, authenticated;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target text := lower(btrim(coalesce(p_target, '')));
  v_issue_id text := nullif(btrim(coalesce(p_doc->>'issue_id', '')), '');
  v_document_id text := nullif(btrim(coalesce(p_doc->>'document_id', '')), '');
  v_hearing_id text := nullif(btrim(coalesce(p_doc->>'hearing_id', '')), '');
  v_content_hash text := nullif(btrim(coalesce(p_doc->>'content_hash', '')), '');
  v_content_markdown text;
  v_normalized_md text;
  v_computed_hash text;
  v_ingest_status text;
  v_chunk_count int;
  v_nonempty_chunks int;
  v_existing_hash text;
  v_existing_chunker text;
  v_incoming_chunker text := 'md-sections-v1';
  v_hearing_doc_id uuid;
  v_inserted int := 0;
  v_kept int[] := '{}';
  v_chunk jsonb;
  v_idx int;
  v_meta jsonb;
  v_section_title text;
  v_heading_path text;
  v_page int;
  v_page_start int;
  v_page_end int;
  v_content text;
  v_raw text;
  v_validation jsonb;
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
  IF v_chunk_count = 0 THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'empty_chunks');
  END IF;

  IF v_chunk_count > 2000 THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'too_many_chunks');
  END IF;

  SELECT count(*)::int
  INTO v_nonempty_chunks
  FROM jsonb_array_elements(p_chunks) elem
  WHERE coalesce(btrim(coalesce(elem->>'content', '')), '') <> '';

  IF coalesce(v_nonempty_chunks, 0) = 0 THEN
    RETURN jsonb_build_object('status', 'error', 'error', 'empty_chunks');
  END IF;

  v_validation := public._n8n_docling_validate_doc(p_doc);
  IF v_validation IS NOT NULL THEN
    RETURN v_validation;
  END IF;

  v_validation := public._n8n_docling_validate_chunks(p_chunks);
  IF v_validation IS NOT NULL THEN
    RETURN v_validation;
  END IF;

  v_incoming_chunker := coalesce(nullif(btrim(coalesce(p_doc->>'chunker', '')), ''), 'md-sections-v1');

  IF p_doc ? 'content_markdown' THEN
    v_content_markdown := nullif(p_doc->>'content_markdown', '');
    -- Match lib/document-chunking.ts documentContentHash (CRLF → LF, trim, leading BOM).
    v_normalized_md := regexp_replace(coalesce(v_content_markdown, ''), E'\r\n', E'\n', 'g');
    v_normalized_md := regexp_replace(
      v_normalized_md,
      '^[[:space:]' || chr(65279) || ']+|[[:space:]' || chr(65279) || ']+$',
      '',
      'g'
    );
    IF v_normalized_md <> '' THEN
      v_computed_hash := encode(sha256(convert_to(v_normalized_md, 'UTF8')), 'hex');
      IF v_content_hash IS NOT NULL AND v_content_hash <> v_computed_hash THEN
        RETURN jsonb_build_object('status', 'error', 'error', 'content_hash_mismatch');
      END IF;
      IF v_content_hash IS NULL THEN
        v_content_hash := v_computed_hash;
      END IF;
    END IF;
  END IF;

  IF p_doc ? 'content_markdown' AND coalesce(btrim(coalesce(v_content_markdown, '')), '') <> '' THEN
    v_ingest_status := 'converted';
  ELSIF p_doc ? 'ingest_status' THEN
    v_ingest_status := coalesce(nullif(btrim(p_doc->>'ingest_status'), ''), 'pending');
  ELSE
    v_ingest_status := NULL;
  END IF;

  IF v_target = 'sak' THEN
    IF v_issue_id IS NULL THEN
      RETURN jsonb_build_object('status', 'error', 'error', 'missing_issue_id');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.stortinget_issues i WHERE i.id = v_issue_id) THEN
      RETURN jsonb_build_object('status', 'skipped_no_issue');
    END IF;

    SELECT d.content_hash, d.chunker
    INTO v_existing_hash, v_existing_chunker
    FROM public.stortinget_issue_documents d
    WHERE d.issue_id = v_issue_id
      AND d.document_id = v_document_id;

    IF v_content_hash IS NOT NULL
      AND v_existing_hash IS NOT NULL
      AND v_content_hash = v_existing_hash
      AND coalesce(nullif(btrim(v_existing_chunker), ''), 'md-sections-v1') = v_incoming_chunker THEN
      RETURN jsonb_build_object(
        'status', 'unchanged',
        'document_id', v_document_id,
        'chunks', v_nonempty_chunks
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
      CASE WHEN p_doc ? 'page_count' THEN (p_doc->>'page_count')::int ELSE NULL END,
      nullif(btrim(coalesce(p_doc->>'ingest_version', '')), ''),
      nullif(btrim(coalesce(p_doc->>'chunker', '')), ''),
      nullif(btrim(coalesce(p_doc->>'pdf_url', '')), ''),
      coalesce(v_ingest_status, 'pending'),
      'pending',
      coalesce((p_doc->>'fetched_at')::timestamptz, now())
    )
    ON CONFLICT (issue_id, document_id) DO UPDATE SET
      title = CASE
        WHEN p_doc ? 'title'
          THEN coalesce(
            nullif(btrim(coalesce(p_doc->>'title', '')), ''),
            public.stortinget_issue_documents.title,
            'Dokument'
          )
        ELSE public.stortinget_issue_documents.title
      END,
      document_type = CASE
        WHEN p_doc ? 'document_kind' OR p_doc ? 'document_type'
          THEN coalesce(
            nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'document_type', '')), ''),
            public.stortinget_issue_documents.document_type,
            'unknown'
          )
        ELSE public.stortinget_issue_documents.document_type
      END,
      source_url = CASE
        WHEN p_doc ? 'source_url'
          THEN coalesce(
            nullif(btrim(coalesce(p_doc->>'source_url', '')), ''),
            public.stortinget_issue_documents.source_url
          )
        ELSE public.stortinget_issue_documents.source_url
      END,
      content_hash = coalesce(v_content_hash, public.stortinget_issue_documents.content_hash),
      content_markdown = CASE WHEN p_doc ? 'content_markdown' THEN v_content_markdown ELSE public.stortinget_issue_documents.content_markdown END,
      markdown_source = CASE WHEN p_doc ? 'markdown_source' THEN nullif(btrim(p_doc->>'markdown_source'), '') ELSE public.stortinget_issue_documents.markdown_source END,
      page_count = CASE WHEN p_doc ? 'page_count' THEN (p_doc->>'page_count')::int ELSE public.stortinget_issue_documents.page_count END,
      ingest_version = CASE WHEN p_doc ? 'ingest_version' THEN nullif(btrim(p_doc->>'ingest_version'), '') ELSE public.stortinget_issue_documents.ingest_version END,
      chunker = CASE WHEN p_doc ? 'chunker' THEN nullif(btrim(p_doc->>'chunker'), '') ELSE public.stortinget_issue_documents.chunker END,
      pdf_url = CASE WHEN p_doc ? 'pdf_url' THEN nullif(btrim(p_doc->>'pdf_url'), '') ELSE public.stortinget_issue_documents.pdf_url END,
      ingest_status = coalesce(v_ingest_status, public.stortinget_issue_documents.ingest_status),
      chunks_status = 'pending',
      fetched_at = CASE WHEN p_doc ? 'fetched_at' THEN (p_doc->>'fetched_at')::timestamptz ELSE public.stortinget_issue_documents.fetched_at END;

    FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
    LOOP
      v_content := coalesce(v_chunk->>'content', '');
      IF coalesce(btrim(v_content), '') = '' THEN
        CONTINUE;
      END IF;

      v_idx := (v_chunk->>'chunk_index')::int;
      v_meta := coalesce(v_chunk->'metadata', '{}'::jsonb);

      v_heading_path := nullif(btrim(coalesce(v_meta->>'heading_path', v_chunk->>'heading_path', '')), '');
      v_section_title := nullif(btrim(coalesce(v_meta->>'section_title', v_chunk->>'section_title', v_heading_path, '')), '');

      v_page_start := NULL;
      v_page_end := NULL;
      v_page := NULL;

      IF v_chunk ? 'page_start' OR (v_meta ? 'page_start') THEN
        v_raw := nullif(btrim(coalesce(v_meta->>'page_start', v_chunk->>'page_start', '')), '');
        IF v_raw IS NOT NULL THEN v_page_start := v_raw::int; END IF;
      END IF;

      IF v_chunk ? 'page_end' OR (v_meta ? 'page_end') THEN
        v_raw := nullif(btrim(coalesce(v_meta->>'page_end', v_chunk->>'page_end', '')), '');
        IF v_raw IS NOT NULL THEN v_page_end := v_raw::int; END IF;
      END IF;

      IF v_chunk ? 'page' OR (v_meta ? 'page') THEN
        v_raw := nullif(btrim(coalesce(v_meta->>'page', v_chunk->>'page', '')), '');
        IF v_raw IS NOT NULL THEN v_page := v_raw::int; END IF;
      END IF;

      v_page := coalesce(v_page, v_page_start);

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
        v_content,
        'pending',
        'pending',
        v_meta
      )
      ON CONFLICT (issue_id, document_id, chunk_index) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        embedding_status = CASE
          WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 'pending'
          ELSE public.document_chunks.embedding_status
        END,
        embedding = CASE
          WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN NULL
          ELSE public.document_chunks.embedding
        END,
        embedding_v2 = CASE
          WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN NULL
          ELSE public.document_chunks.embedding_v2
        END,
        embedding_v2_status = CASE
          WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 'pending'
          ELSE public.document_chunks.embedding_v2_status
        END,
        embedding_v2_attempts = CASE
          WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 0
          ELSE public.document_chunks.embedding_v2_attempts
        END;

      v_kept := array_append(v_kept, v_idx);
      v_inserted := v_inserted + 1;
    END LOOP;

    DELETE FROM public.document_chunks c
    WHERE c.issue_id = v_issue_id
      AND c.document_id = v_document_id
      AND c.hearing_document_id IS NULL
      AND NOT (c.chunk_index = ANY (v_kept));

    RETURN jsonb_build_object(
      'status', 'upserted',
      'document_id', v_document_id,
      'chunks', v_inserted
    );
  END IF;

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

  SELECT d.content_hash, d.id, d.chunker
  INTO v_existing_hash, v_hearing_doc_id, v_existing_chunker
  FROM public.hearing_documents d
  WHERE d.hearing_id = v_hearing_id
    AND d.external_key = v_document_id;

  IF v_content_hash IS NOT NULL
    AND v_existing_hash IS NOT NULL
    AND v_content_hash = v_existing_hash
    AND coalesce(nullif(btrim(v_existing_chunker), ''), 'md-sections-v1') = v_incoming_chunker THEN
    RETURN jsonb_build_object(
      'status', 'unchanged',
      'document_id', v_document_id,
      'chunks', v_nonempty_chunks
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
    chunker,
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
    v_incoming_chunker,
    CASE
      WHEN p_doc ? 'page_count' AND p_doc->>'page_count' IS NOT NULL THEN (p_doc->>'page_count')::int
      ELSE NULL
    END,
    coalesce(v_ingest_status, 'pending'),
    'pending',
    'converted',
    coalesce((p_doc->>'fetched_at')::timestamptz, now()),
    now()
  )
  ON CONFLICT (hearing_id, external_key) DO UPDATE SET
    title = CASE
      WHEN p_doc ? 'title'
        THEN coalesce(
          nullif(btrim(coalesce(p_doc->>'title', '')), ''),
          public.hearing_documents.title,
          'Dokument'
        )
      ELSE public.hearing_documents.title
    END,
    kind = CASE
      WHEN p_doc ? 'document_kind' OR p_doc ? 'kind'
        THEN coalesce(
          nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'kind', '')), ''),
          public.hearing_documents.kind,
          'unknown'
        )
      ELSE public.hearing_documents.kind
    END,
    document_kind = CASE
      WHEN p_doc ? 'document_kind' OR p_doc ? 'kind'
        THEN coalesce(
          nullif(btrim(coalesce(p_doc->>'document_kind', p_doc->>'kind', '')), ''),
          public.hearing_documents.document_kind,
          'unknown'
        )
      ELSE public.hearing_documents.document_kind
    END,
    source_url = CASE
      WHEN p_doc ? 'source_url'
        THEN coalesce(
          nullif(btrim(coalesce(p_doc->>'source_url', '')), ''),
          public.hearing_documents.source_url
        )
      ELSE public.hearing_documents.source_url
    END,
    pdf_url = CASE WHEN p_doc ? 'pdf_url' THEN nullif(btrim(p_doc->>'pdf_url'), '') ELSE public.hearing_documents.pdf_url END,
    markdown = CASE WHEN p_doc ? 'content_markdown' THEN v_content_markdown ELSE public.hearing_documents.markdown END,
    content_markdown = CASE WHEN p_doc ? 'content_markdown' THEN v_content_markdown ELSE public.hearing_documents.content_markdown END,
    content_hash = coalesce(v_content_hash, public.hearing_documents.content_hash),
    chunker = CASE
      WHEN p_doc ? 'chunker'
        THEN coalesce(
          nullif(btrim(coalesce(p_doc->>'chunker', '')), ''),
          public.hearing_documents.chunker,
          'md-sections-v1'
        )
      ELSE public.hearing_documents.chunker
    END,
    page_count = CASE
      WHEN p_doc ? 'page_count' AND p_doc->>'page_count' IS NOT NULL
        THEN (p_doc->>'page_count')::int
      WHEN p_doc ? 'page_count'
        THEN NULL
      ELSE public.hearing_documents.page_count
    END,
    ingest_status = coalesce(v_ingest_status, public.hearing_documents.ingest_status),
    chunks_status = 'pending',
    status = 'converted',
    fetched_at = CASE WHEN p_doc ? 'fetched_at' THEN (p_doc->>'fetched_at')::timestamptz ELSE public.hearing_documents.fetched_at END,
    updated_at = now()
  RETURNING id INTO v_hearing_doc_id;

  v_kept := '{}';
  v_inserted := 0;

  FOR v_chunk IN SELECT value FROM jsonb_array_elements(p_chunks)
  LOOP
    v_content := coalesce(v_chunk->>'content', '');
    IF coalesce(btrim(v_content), '') = '' THEN
      CONTINUE;
    END IF;

    v_idx := (v_chunk->>'chunk_index')::int;
    v_meta := coalesce(v_chunk->'metadata', '{}'::jsonb);

    v_heading_path := nullif(btrim(coalesce(v_meta->>'heading_path', v_chunk->>'heading_path', '')), '');
    v_section_title := nullif(btrim(coalesce(v_meta->>'section_title', v_chunk->>'section_title', v_heading_path, '')), '');

    v_page_start := NULL;
    v_page_end := NULL;
    v_page := NULL;

    IF v_chunk ? 'page_start' OR (v_meta ? 'page_start') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page_start', v_chunk->>'page_start', '')), '');
      IF v_raw IS NOT NULL THEN v_page_start := v_raw::int; END IF;
    END IF;

    IF v_chunk ? 'page_end' OR (v_meta ? 'page_end') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page_end', v_chunk->>'page_end', '')), '');
      IF v_raw IS NOT NULL THEN v_page_end := v_raw::int; END IF;
    END IF;

    IF v_chunk ? 'page' OR (v_meta ? 'page') THEN
      v_raw := nullif(btrim(coalesce(v_meta->>'page', v_chunk->>'page', '')), '');
      IF v_raw IS NOT NULL THEN v_page := v_raw::int; END IF;
    END IF;

    v_page := coalesce(v_page, v_page_start);

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
      NULL,
      v_document_id,
      v_idx,
      v_content,
      'pending',
      'pending',
      v_meta
    )
    ON CONFLICT (hearing_document_id, chunk_index) WHERE hearing_document_id IS NOT NULL DO UPDATE SET
      content = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      embedding_status = CASE
        WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 'pending'
        ELSE public.document_chunks.embedding_status
      END,
      embedding = CASE
        WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN NULL
        ELSE public.document_chunks.embedding
      END,
      embedding_v2 = CASE
        WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN NULL
        ELSE public.document_chunks.embedding_v2
      END,
      embedding_v2_status = CASE
        WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 'pending'
        ELSE public.document_chunks.embedding_v2_status
      END,
      embedding_v2_attempts = CASE
        WHEN public.document_chunks.content IS DISTINCT FROM EXCLUDED.content THEN 0
        ELSE public.document_chunks.embedding_v2_attempts
      END;

    v_kept := array_append(v_kept, v_idx);
    v_inserted := v_inserted + 1;
  END LOOP;

  DELETE FROM public.document_chunks c
  WHERE c.hearing_document_id = v_hearing_doc_id
    AND NOT (c.chunk_index = ANY (v_kept));

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
SET search_path = public, pg_temp
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
DROP FUNCTION IF EXISTS public.save_embeddings_v2(jsonb, text, boolean);

CREATE OR REPLACE FUNCTION public.save_embeddings_v2(
  p_rows jsonb,
  p_model text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_id uuid;
  v_emb vector(1024);
  v_dims int;
  v_saved int := 0;
  v_failed int := 0;
  v_skipped int := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('saved', 0, 'failed', 0, 'skipped', 0, 'error', 'rows_must_be_array');
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_id := (v_row->>'id')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        v_failed := v_failed + 1;
        CONTINUE;
    END;

    IF v_id IS NULL THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    IF NOT p_force AND EXISTS (
      SELECT 1 FROM public.document_chunks c WHERE c.id = v_id AND c.embedding_v2 IS NOT NULL
    ) THEN
      v_skipped := v_skipped + 1;
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
    WHERE c.id = v_id
      AND (p_force OR c.embedding_v2 IS NULL);

    IF FOUND THEN
      v_saved := v_saved + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'failed', v_failed, 'skipped', v_skipped);
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
SET search_path = public, pg_temp
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
      OR dc.metadata->>'issue_id' = ANY (filter_issue_ids)
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
REVOKE ALL ON FUNCTION public.save_embeddings_v2(jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_document_chunks_v2(vector, int, text[], text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_docling_document(text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_chunks_missing_v2(int, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_embeddings_v2(jsonb, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_document_chunks_v2(vector, int, text[], text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
