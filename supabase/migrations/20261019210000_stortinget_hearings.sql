-- P9: Cache Stortinget hearings + hearing documents for RAG (docling pipeline, n8n sync).
-- Additive with parallel migrations 20261019200000 (hybrid search) and 20261019203000 (chunking).

BEGIN;

-- ---------------------------------------------------------------------------
-- stortinget_hearings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stortinget_hearings (
  id text PRIMARY KEY,
  sesjon text,
  komite_id text,
  komite_navn text,
  tittel text NOT NULL DEFAULT '',
  tema text,
  horing_status text,
  status_kind text,
  innspillsfrist timestamptz,
  anmodningsfrist timestamptz,
  soknadfrist timestamptz,
  start_dato timestamptz,
  skriftlig boolean NOT NULL DEFAULT false,
  skriftlig_innspill_url text NOT NULL,
  related_issue_ids text[] NOT NULL DEFAULT '{}',
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stortinget_hearings_id_nonempty CHECK (char_length(btrim(id)) > 0)
);

CREATE INDEX IF NOT EXISTS stortinget_hearings_innspillsfrist_idx
  ON public.stortinget_hearings (innspillsfrist DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS stortinget_hearings_status_kind_idx
  ON public.stortinget_hearings (status_kind);

CREATE INDEX IF NOT EXISTS stortinget_hearings_related_issue_ids_gin
  ON public.stortinget_hearings USING gin (related_issue_ids);

ALTER TABLE public.stortinget_hearings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stortinget_hearings FROM PUBLIC;
REVOKE ALL ON TABLE public.stortinget_hearings FROM anon;
REVOKE ALL ON TABLE public.stortinget_hearings FROM authenticated;

GRANT SELECT ON TABLE public.stortinget_hearings TO anon;
GRANT SELECT ON TABLE public.stortinget_hearings TO authenticated;
GRANT ALL ON TABLE public.stortinget_hearings TO service_role;

DROP POLICY IF EXISTS stortinget_hearings_public_read ON public.stortinget_hearings;
CREATE POLICY stortinget_hearings_public_read
  ON public.stortinget_hearings
  FOR SELECT
  TO anon, authenticated
  USING (id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- hearing_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hearing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id text NOT NULL REFERENCES public.stortinget_hearings (id) ON DELETE CASCADE,
  external_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'unknown',
  source_url text,
  markdown text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hearing_documents_external_key_nonempty CHECK (char_length(btrim(external_key)) > 0),
  CONSTRAINT hearing_documents_status_check CHECK (
    status IN ('pending', 'converting', 'converted', 'chunked', 'embedded', 'failed')
  ),
  CONSTRAINT hearing_documents_hearing_external_key UNIQUE (hearing_id, external_key)
);

CREATE INDEX IF NOT EXISTS hearing_documents_status_idx
  ON public.hearing_documents (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS hearing_documents_hearing_id_idx
  ON public.hearing_documents (hearing_id);

ALTER TABLE public.hearing_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hearing_documents FROM PUBLIC;
REVOKE ALL ON TABLE public.hearing_documents FROM anon;
REVOKE ALL ON TABLE public.hearing_documents FROM authenticated;

GRANT SELECT ON TABLE public.hearing_documents TO anon;
GRANT SELECT ON TABLE public.hearing_documents TO authenticated;
GRANT ALL ON TABLE public.hearing_documents TO service_role;

DROP POLICY IF EXISTS hearing_documents_public_read ON public.hearing_documents;
CREATE POLICY hearing_documents_public_read
  ON public.hearing_documents
  FOR SELECT
  TO anon, authenticated
  USING (hearing_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- document_chunks: optional hearing linkage (sak chunks unchanged)
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS hearing_id text REFERENCES public.stortinget_hearings (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS hearing_document_id uuid REFERENCES public.hearing_documents (id) ON DELETE CASCADE;

ALTER TABLE public.document_chunks
  ALTER COLUMN issue_id DROP NOT NULL;

-- Sak ingest uses ON CONFLICT (issue_id, document_id, chunk_index) — keep the table UNIQUE intact.
DROP INDEX IF EXISTS public.document_chunks_issue_doc_chunk_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_chunks_issue_id_document_id_chunk_index_key'
      AND conrelid = 'public.document_chunks'::regclass
  ) THEN
    ALTER TABLE public.document_chunks
      ADD CONSTRAINT document_chunks_issue_id_document_id_chunk_index_key
      UNIQUE (issue_id, document_id, chunk_index);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_hearing_doc_chunk_key
  ON public.document_chunks (hearing_document_id, chunk_index)
  WHERE hearing_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_chunks_hearing_id_idx
  ON public.document_chunks (hearing_id)
  WHERE hearing_id IS NOT NULL;

ALTER TABLE public.document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_sak_or_hearing_check;

ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_sak_or_hearing_check CHECK (
    (issue_id IS NOT NULL AND hearing_document_id IS NULL)
    OR (hearing_document_id IS NOT NULL AND issue_id IS NULL)
  );

-- ---------------------------------------------------------------------------
-- n8n / service_role RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_upsert_stortinget_hearing(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := btrim(coalesce(p_payload->>'id', ''));
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_id');
  END IF;

  INSERT INTO public.stortinget_hearings (
    id,
    sesjon,
    komite_id,
    komite_navn,
    tittel,
    tema,
    horing_status,
    status_kind,
    innspillsfrist,
    anmodningsfrist,
    soknadfrist,
    start_dato,
    skriftlig,
    skriftlig_innspill_url,
    related_issue_ids,
    detail_json,
    last_synced_at,
    updated_at
  )
  VALUES (
    v_id,
    nullif(btrim(coalesce(p_payload->>'sesjon', '')), ''),
    nullif(btrim(coalesce(p_payload->>'komite_id', '')), ''),
    nullif(btrim(coalesce(p_payload->>'komite_navn', '')), ''),
    coalesce(nullif(btrim(coalesce(p_payload->>'tittel', '')), ''), 'Høring'),
    nullif(btrim(coalesce(p_payload->>'tema', '')), ''),
    nullif(btrim(coalesce(p_payload->>'horing_status', '')), ''),
    nullif(btrim(coalesce(p_payload->>'status_kind', '')), ''),
    (p_payload->>'innspillsfrist')::timestamptz,
    (p_payload->>'anmodningsfrist')::timestamptz,
    (p_payload->>'soknadfrist')::timestamptz,
    (p_payload->>'start_dato')::timestamptz,
    coalesce((p_payload->>'skriftlig')::boolean, false),
    coalesce(
      nullif(btrim(coalesce(p_payload->>'skriftlig_innspill_url', '')), ''),
      'https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/skriv-skriftlig-innspill/?h=' || v_id
    ),
    coalesce(
      ARRAY(
        SELECT btrim(value)
        FROM jsonb_array_elements_text(coalesce(p_payload->'related_issue_ids', '[]'::jsonb)) AS value
        WHERE btrim(value) <> ''
      ),
      '{}'::text[]
    ),
    coalesce(p_payload->'detail_json', '{}'::jsonb),
    coalesce((p_payload->>'last_synced_at')::timestamptz, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    sesjon = EXCLUDED.sesjon,
    komite_id = EXCLUDED.komite_id,
    komite_navn = EXCLUDED.komite_navn,
    tittel = EXCLUDED.tittel,
    tema = EXCLUDED.tema,
    horing_status = EXCLUDED.horing_status,
    status_kind = EXCLUDED.status_kind,
    innspillsfrist = EXCLUDED.innspillsfrist,
    anmodningsfrist = EXCLUDED.anmodningsfrist,
    soknadfrist = EXCLUDED.soknadfrist,
    start_dato = EXCLUDED.start_dato,
    skriftlig = EXCLUDED.skriftlig,
    skriftlig_innspill_url = EXCLUDED.skriftlig_innspill_url,
    related_issue_ids = EXCLUDED.related_issue_ids,
    detail_json = EXCLUDED.detail_json,
    last_synced_at = EXCLUDED.last_synced_at,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_upsert_hearing_document(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hearing_id text := btrim(coalesce(p_payload->>'hearing_id', ''));
  v_external_key text := btrim(coalesce(p_payload->>'external_key', ''));
  v_id uuid;
  v_status text := coalesce(nullif(btrim(coalesce(p_payload->>'status', '')), ''), 'pending');
BEGIN
  IF v_hearing_id = '' OR v_external_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_hearing_or_key');
  END IF;

  INSERT INTO public.hearing_documents (
    hearing_id,
    external_key,
    title,
    kind,
    source_url,
    markdown,
    status,
    error_message,
    content_hash,
    updated_at
  )
  VALUES (
    v_hearing_id,
    v_external_key,
    coalesce(nullif(btrim(coalesce(p_payload->>'title', '')), ''), 'Dokument'),
    coalesce(nullif(btrim(coalesce(p_payload->>'kind', '')), ''), 'unknown'),
    nullif(btrim(coalesce(p_payload->>'source_url', '')), ''),
    nullif(p_payload->>'markdown', ''),
    v_status,
    nullif(btrim(coalesce(p_payload->>'error_message', '')), ''),
    nullif(btrim(coalesce(p_payload->>'content_hash', '')), ''),
    now()
  )
  ON CONFLICT (hearing_id, external_key) DO UPDATE SET
    title = EXCLUDED.title,
    kind = EXCLUDED.kind,
    source_url = coalesce(EXCLUDED.source_url, public.hearing_documents.source_url),
    markdown = CASE
      WHEN EXCLUDED.content_hash IS NOT NULL
        AND EXCLUDED.content_hash IS DISTINCT FROM public.hearing_documents.content_hash
        THEN EXCLUDED.markdown
      WHEN public.hearing_documents.markdown IS NULL
        THEN EXCLUDED.markdown
      ELSE public.hearing_documents.markdown
    END,
    status = CASE
      WHEN EXCLUDED.content_hash IS NOT NULL
        AND EXCLUDED.content_hash IS DISTINCT FROM public.hearing_documents.content_hash
        THEN EXCLUDED.status
      WHEN public.hearing_documents.status IN ('embedded', 'chunked')
        AND EXCLUDED.status IN ('pending', 'converted')
        THEN public.hearing_documents.status
      ELSE EXCLUDED.status
    END,
    error_message = EXCLUDED.error_message,
    content_hash = coalesce(EXCLUDED.content_hash, public.hearing_documents.content_hash),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_hearing_documents_needing_conversion(p_limit int DEFAULT 8)
RETURNS SETOF public.hearing_documents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.hearing_documents d
  WHERE d.status IN ('pending', 'failed')
    AND d.source_url IS NOT NULL
    AND coalesce(btrim(d.markdown), '') = ''
  ORDER BY d.updated_at ASC
  LIMIT GREATEST(coalesce(p_limit, 8), 1);
$$;

CREATE OR REPLACE FUNCTION public.n8n_save_hearing_document_markdown(
  p_document_id uuid,
  p_markdown text,
  p_content_hash text DEFAULT NULL,
  p_status text DEFAULT 'converted'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.hearing_documents
  SET
    markdown = p_markdown,
    content_hash = coalesce(nullif(btrim(p_content_hash), ''), content_hash),
    status = coalesce(nullif(btrim(p_status), ''), 'converted'),
    error_message = NULL,
    updated_at = now()
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_hearing_documents_needing_chunking(p_limit int DEFAULT 8)
RETURNS SETOF public.hearing_documents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.hearing_documents d
  WHERE d.status = 'converted'
    AND coalesce(btrim(d.markdown), '') <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.hearing_document_id = d.id
    )
  ORDER BY d.updated_at ASC
  LIMIT GREATEST(coalesce(p_limit, 8), 1);
$$;

CREATE OR REPLACE FUNCTION public.n8n_mark_hearing_document_chunked(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.hearing_documents
  SET status = 'chunked', updated_at = now()
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_replace_hearing_document_chunks(
  p_hearing_document_id uuid,
  p_hearing_id text,
  p_document_id text,
  p_chunks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_hearing_document_id IS NULL OR btrim(coalesce(p_hearing_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_ids');
  END IF;

  DELETE FROM public.document_chunks
  WHERE hearing_document_id = p_hearing_document_id;

  INSERT INTO public.document_chunks (
    issue_id,
    hearing_id,
    hearing_document_id,
    document_id,
    chunk_index,
    content,
    embedding_status,
    metadata
  )
  SELECT
    NULL::text,
    p_hearing_id,
    p_hearing_document_id,
    p_document_id,
    (elem->>'chunk_index')::int,
    elem->>'content',
    coalesce(nullif(btrim(elem->>'embedding_status'), ''), 'pending'),
    coalesce(elem->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) AS elem;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.hearing_documents
  SET status = 'chunked', updated_at = now()
  WHERE id = p_hearing_document_id;

  RETURN jsonb_build_object('ok', true, 'count', v_count, 'id', p_hearing_document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_pending_hearing_document_chunks(p_limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  hearing_id text,
  hearing_document_id uuid,
  document_id text,
  chunk_index int,
  content text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.hearing_id,
    c.hearing_document_id,
    c.document_id,
    c.chunk_index,
    c.content
  FROM public.document_chunks c
  WHERE c.hearing_document_id IS NOT NULL
    AND c.embedding_status = 'pending'
  ORDER BY c.created_at ASC
  LIMIT GREATEST(coalesce(p_limit, 8), 1);
$$;

CREATE OR REPLACE FUNCTION public.search_hearing_document_chunks_text(
  p_query text,
  p_hearing_id text DEFAULT NULL,
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  hearing_id text,
  hearing_document_id uuid,
  document_id text,
  chunk_index int,
  content text,
  document_title text,
  document_kind text,
  source_url text,
  rank float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(btrim(coalesce(p_query, '')), '') AS query
  )
  SELECT
    c.id AS chunk_id,
    c.hearing_id,
    c.hearing_document_id,
    c.document_id,
    c.chunk_index,
    c.content,
    coalesce(d.title, c.metadata->>'document_title', '') AS document_title,
    coalesce(d.kind, c.metadata->>'document_kind', '') AS document_kind,
    coalesce(d.source_url, c.metadata->>'source_url', '') AS source_url,
    CASE
      WHEN q.query IS NULL THEN 0::float
      ELSE ts_rank_cd(
        to_tsvector('norwegian', coalesce(c.content, '')),
        websearch_to_tsquery('norwegian', q.query)
      )::float
    END AS rank
  FROM public.document_chunks c
  JOIN public.hearing_documents d ON d.id = c.hearing_document_id
  CROSS JOIN q
  WHERE c.hearing_document_id IS NOT NULL
    AND (p_hearing_id IS NULL OR c.hearing_id = p_hearing_id)
    AND (
      q.query IS NULL
      OR to_tsvector('norwegian', coalesce(c.content, ''))
        @@ websearch_to_tsquery('norwegian', q.query)
      OR c.content ILIKE '%' || left(q.query, 80) || '%'
    )
  ORDER BY rank DESC, c.chunk_index ASC
  LIMIT GREATEST(coalesce(p_match_count, 8), 1);
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_stortinget_hearing(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_upsert_hearing_document(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_hearing_documents_needing_conversion(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_save_hearing_document_markdown(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_hearing_documents_needing_chunking(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_mark_hearing_document_chunked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_replace_hearing_document_chunks(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_pending_hearing_document_chunks(int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_stortinget_hearing(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_hearing_document(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_hearing_documents_needing_conversion(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_save_hearing_document_markdown(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_hearing_documents_needing_chunking(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_mark_hearing_document_chunked(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_replace_hearing_document_chunks(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_pending_hearing_document_chunks(int) TO service_role;

GRANT EXECUTE ON FUNCTION public.search_hearing_document_chunks_text(text, text, int) TO service_role, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Extend hybrid search so filter_hearing_id queries hearing_document chunks
-- (PR #179 joins only stortinget_issues and excludes hearing-only rows).
-- Depends on tsv / embedding_v2 from 20261019200000 when present; ensure columns exist
-- so this migration applies on branches that land before hybrid search.
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('norwegian', coalesce(content, ''))
  ) STORED;

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1024);

DROP FUNCTION IF EXISTS public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  text,
  int
);

CREATE OR REPLACE FUNCTION public.search_chunks_hybrid(
  query_text text,
  query_embedding vector(1024) DEFAULT NULL,
  filter_issue_ids text[] DEFAULT NULL,
  filter_document_kinds text[] DEFAULT NULL,
  filter_sesjon text DEFAULT NULL,
  filter_komite text DEFAULT NULL,
  filter_ferdigbehandlet boolean DEFAULT NULL,
  filter_published_after timestamptz DEFAULT NULL,
  filter_hearing_id text DEFAULT NULL,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  issue_id text,
  hearing_id text,
  hearing_document_id uuid,
  document_id text,
  document_title text,
  document_kind text,
  source_url text,
  chunk_index int,
  content text,
  score_lexical real,
  score_semantic real,
  score_fused real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(btrim(coalesce(query_text, '')), '') AS qtext,
      CASE
        WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
        ELSE websearch_to_tsquery('norwegian', nullif(btrim(coalesce(query_text, '')), ''))
      END AS tsq,
      GREATEST(coalesce(match_count, 8), 1) AS k,
      query_embedding AS qemb,
      filter_issue_ids AS issue_ids,
      filter_document_kinds AS doc_kinds,
      nullif(btrim(coalesce(filter_sesjon, '')), '') AS sesjon,
      nullif(btrim(coalesce(filter_komite, '')), '') AS komite,
      filter_ferdigbehandlet AS ferdig,
      filter_published_after AS published_after,
      nullif(btrim(coalesce(filter_hearing_id, '')), '') AS hearing_id
  ),
  base AS (
    SELECT
      dc.id,
      dc.issue_id,
      dc.hearing_id,
      dc.hearing_document_id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.tsv,
      dc.embedding_v2,
      coalesce(d.title, dc.metadata->>'document_title') AS document_title,
      coalesce(d.document_type, dc.metadata->>'document_kind') AS document_kind,
      d.source_url,
      i.ferdigbehandlet,
      i.first_seen_at,
      coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) AS issue_sesjon,
      nullif(trim(i.detail_json->'komite'->>'navn'), '') AS issue_komite
    FROM public.document_chunks dc
    JOIN public.stortinget_issues i ON i.id = dc.issue_id
    LEFT JOIN public.stortinget_issue_documents d
      ON d.issue_id = dc.issue_id AND d.document_id = dc.document_id
    CROSS JOIN params p
    WHERE p.hearing_id IS NULL
      AND dc.hearing_document_id IS NULL
      AND (p.issue_ids IS NULL OR dc.issue_id = ANY (p.issue_ids))
      AND (
        p.doc_kinds IS NULL
        OR coalesce(d.document_type, dc.metadata->>'document_kind') = ANY (p.doc_kinds)
      )
      AND (p.sesjon IS NULL OR coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) = p.sesjon)
      AND (p.komite IS NULL OR nullif(trim(i.detail_json->'komite'->>'navn'), '') = p.komite)
      AND (p.ferdig IS NULL OR i.ferdigbehandlet IS NOT DISTINCT FROM p.ferdig)
      AND (p.published_after IS NULL OR i.first_seen_at >= p.published_after)
    UNION ALL
    SELECT
      dc.id,
      dc.issue_id,
      dc.hearing_id,
      dc.hearing_document_id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.tsv,
      dc.embedding_v2,
      coalesce(hd.title, dc.metadata->>'document_title') AS document_title,
      coalesce(hd.kind, dc.metadata->>'document_kind') AS document_kind,
      hd.source_url,
      NULL::boolean AS ferdigbehandlet,
      NULL::timestamptz AS first_seen_at,
      NULL::text AS issue_sesjon,
      NULL::text AS issue_komite
    FROM public.document_chunks dc
    JOIN public.hearing_documents hd ON hd.id = dc.hearing_document_id
    CROSS JOIN params p
    WHERE p.hearing_id IS NOT NULL
      AND dc.hearing_id = p.hearing_id
      AND (
        p.doc_kinds IS NULL
        OR coalesce(hd.kind, dc.metadata->>'document_kind') = ANY (p.doc_kinds)
      )
  ),
  lexical AS (
    SELECT
      b.id,
      b.issue_id,
      b.hearing_id,
      b.hearing_document_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      ts_rank_cd(b.tsv, p.tsq)::real AS score_lexical,
      row_number() OVER (
        ORDER BY ts_rank_cd(b.tsv, p.tsq) DESC, b.chunk_index ASC
      )::int AS lex_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.tsq IS NOT NULL
      AND b.tsv @@ p.tsq
    ORDER BY score_lexical DESC, b.chunk_index ASC
    LIMIT 30
  ),
  semantic AS (
    SELECT
      b.id,
      b.issue_id,
      b.hearing_id,
      b.hearing_document_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      (1 - (b.embedding_v2 <=> p.qemb))::real AS score_semantic,
      row_number() OVER (
        ORDER BY b.embedding_v2 <=> p.qemb ASC
      )::int AS sem_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.qemb IS NOT NULL
      AND b.embedding_v2 IS NOT NULL
    ORDER BY b.embedding_v2 <=> p.qemb ASC
    LIMIT 30
  ),
  fused AS (
    SELECT
      coalesce(l.id, s.id) AS id,
      coalesce(l.issue_id, s.issue_id) AS issue_id,
      coalesce(l.hearing_id, s.hearing_id) AS hearing_id,
      coalesce(l.hearing_document_id, s.hearing_document_id) AS hearing_document_id,
      coalesce(l.document_id, s.document_id) AS document_id,
      coalesce(l.chunk_index, s.chunk_index) AS chunk_index,
      coalesce(l.content, s.content) AS content,
      coalesce(l.document_title, s.document_title) AS document_title,
      coalesce(l.document_kind, s.document_kind) AS document_kind,
      coalesce(l.source_url, s.source_url) AS source_url,
      l.score_lexical,
      s.score_semantic,
      (
        coalesce(1.0 / (60.0 + l.lex_rank), 0.0)
        + coalesce(1.0 / (60.0 + s.sem_rank), 0.0)
      )::real AS score_fused
    FROM lexical l
    FULL OUTER JOIN semantic s ON s.id = l.id
  ),
  fallback AS (
    SELECT
      b.id,
      b.issue_id,
      b.hearing_id,
      b.hearing_document_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      0::real AS score_lexical,
      NULL::real AS score_semantic,
      0::real AS score_fused
    FROM base b
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM fused)
      AND p.qtext IS NOT NULL
      AND b.content ILIKE '%' || left(p.qtext, 80) || '%'
    ORDER BY b.chunk_index ASC
    LIMIT (SELECT k FROM params)
  )
  SELECT
    f.id,
    f.issue_id,
    f.hearing_id,
    f.hearing_document_id,
    f.document_id,
    f.document_title,
    f.document_kind,
    f.source_url,
    f.chunk_index,
    f.content,
    f.score_lexical,
    f.score_semantic,
    f.score_fused
  FROM (
    SELECT * FROM fused
    UNION ALL
    SELECT * FROM fallback
  ) f
  ORDER BY f.score_fused DESC, f.chunk_index ASC
  LIMIT (SELECT k FROM params);
$$;

REVOKE ALL ON FUNCTION public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  text,
  int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  text,
  int
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
