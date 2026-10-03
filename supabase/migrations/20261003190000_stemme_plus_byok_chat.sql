-- Stemme+ BYOK credentials (service-role only) + lexical RAG helpers for the chatbot.
-- Embeddings stay in document_chunks (n8n/Ollama). These RPCs never select embedding columns.

CREATE TABLE IF NOT EXISTS public.user_llm_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  base_url text,
  ciphertext_b64 text NOT NULL,
  iv_b64 text NOT NULL,
  auth_tag_b64 text NOT NULL,
  key_last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_llm_credentials_provider_check
    CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'ai_gateway')),
  CONSTRAINT user_llm_credentials_last4_check
    CHECK (char_length(key_last4) BETWEEN 2 AND 8)
);

COMMENT ON TABLE public.user_llm_credentials IS
  'Encrypted user BYOK LLM keys. Ciphertext is service_role only; never expose to the browser.';

ALTER TABLE public.user_llm_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_llm_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_llm_credentials TO service_role;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stripe_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.search_issue_document_chunks_text(
  p_issue_id text,
  p_query text,
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  document_id text,
  chunk_index int,
  content text,
  rank float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(btrim(coalesce(p_query, '')), '') AS query
  )
  SELECT
    dc.document_id,
    dc.chunk_index,
    dc.content,
    CASE
      WHEN q.query IS NULL THEN 0::float
      ELSE ts_rank_cd(
        to_tsvector('simple', coalesce(dc.content, '')),
        plainto_tsquery('simple', q.query)
      )::float
    END AS rank
  FROM public.document_chunks dc
  CROSS JOIN q
  WHERE dc.issue_id = p_issue_id
    AND (
      q.query IS NULL
      OR to_tsvector('simple', coalesce(dc.content, ''))
        @@ plainto_tsquery('simple', q.query)
      OR dc.content ILIKE '%' || left(q.query, 80) || '%'
    )
  ORDER BY rank DESC, dc.chunk_index ASC
  LIMIT GREATEST(coalesce(p_match_count, 8), 1);
$$;

CREATE OR REPLACE FUNCTION public.search_stortinget_issues_for_chat(
  p_query text,
  p_limit int DEFAULT 6
)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  ferdigbehandlet boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.title,
    left(coalesce(i.summary, ''), 400) AS summary,
    i.henvisning,
    i.ferdigbehandlet
  FROM public.stortinget_issues i
  WHERE nullif(btrim(coalesce(p_query, '')), '') IS NOT NULL
    AND (
      i.title ILIKE '%' || left(btrim(p_query), 80) || '%'
      OR coalesce(i.summary, '') ILIKE '%' || left(btrim(p_query), 80) || '%'
      OR i.id = btrim(p_query)
    )
  ORDER BY
    CASE WHEN i.id = btrim(p_query) THEN 0 ELSE 1 END,
    i.last_synced_at DESC NULLS LAST
  LIMIT GREATEST(coalesce(p_limit, 6), 1);
$$;

REVOKE ALL ON FUNCTION public.search_issue_document_chunks_text(text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_stortinget_issues_for_chat(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issue_document_chunks_text(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_stortinget_issues_for_chat(text, int) TO service_role;
