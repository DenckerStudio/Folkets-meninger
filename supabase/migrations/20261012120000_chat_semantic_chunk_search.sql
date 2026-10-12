-- Overlay chat semantic retrieval.
--
-- `match_issue_document_chunks` ranks one sak's `document_chunks` by cosine
-- similarity to a query vector. The stored vectors are `vector(768)`, produced
-- externally by n8n + Ollama. Overlay chat reuses the user's own Ollama BYOK
-- credential to vectorize the query, then calls this RPC with the session client
-- (never the service role).
--
-- The function only returns chunks for one `issue_id`, and `document_chunks`
-- already allows SELECT to `anon, authenticated`
-- (`document_chunks_select_all`), so exposing the ranking RPC adds no new data
-- exposure — it is the same rows, ordered by similarity. The app falls back to
-- lexical chunk search when the RPC is unavailable, so missing grant = no break.

GRANT EXECUTE ON FUNCTION public.match_issue_document_chunks(text, vector, int)
  TO anon, authenticated;
