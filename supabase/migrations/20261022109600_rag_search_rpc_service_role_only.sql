-- Stemme+ chat calls hybrid search RPCs server-side with service_role (after requireStemmePlus).
BEGIN;

REVOKE ALL ON FUNCTION public.search_issues_fts(text, text[], int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issues_fts(text, text[], int) TO service_role;

REVOKE ALL ON FUNCTION public.search_chunks_hybrid(
  text, vector, text[], text[], text, text, boolean, timestamptz, text, int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_chunks_hybrid(
  text, vector, text[], text[], text, text, boolean, timestamptz, text, int
) TO service_role;

REVOKE ALL ON FUNCTION public.search_hearing_document_chunks_text(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_hearing_document_chunks_text(text, text, int) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.search_stortinget_issues_for_chat(text,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.search_stortinget_issues_for_chat(text, int) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.search_stortinget_issues_for_chat(text, int) TO service_role;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.search_issue_document_chunks_text(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issue_document_chunks_text(text, text, int) TO service_role;

REVOKE ALL ON FUNCTION public.fm_unaccent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fm_unaccent(text) TO service_role;

REVOKE ALL ON FUNCTION public.fm_escape_ilike(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fm_escape_ilike(text) TO service_role;

COMMIT;
