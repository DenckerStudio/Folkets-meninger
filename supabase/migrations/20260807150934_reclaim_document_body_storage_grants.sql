-- reclaim_document_body_storage is service-role only (ops helper).
REVOKE ALL ON FUNCTION public.reclaim_document_body_storage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reclaim_document_body_storage() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_document_body_storage() TO service_role;
