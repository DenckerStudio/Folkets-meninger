-- OPTIONAL manual template — NOT applied by CI.
-- Use only if Expert replaces GENERATED document_chunks.tsv with a plain column
-- and needs batched population on large prod (380k+ rows).
--
-- Example loop (run from shell, adjust batch size):
--   while psql ... -c "SELECT count(*) FROM document_chunks WHERE tsv IS NULL" | grep -qv '^0$'; do
--     psql ... -v ON_ERROR_STOP=1 -c "
--       WITH batch AS (
--         SELECT id FROM public.document_chunks WHERE tsv IS NULL LIMIT 5000
--       )
--       UPDATE public.document_chunks dc
--       SET tsv = to_tsvector('norwegian', coalesce(dc.content, ''))
--       FROM batch b WHERE dc.id = b.id;
--     "
--   done
--
-- Then create GIN with 20261022109000 (CONCURRENTLY).

SELECT 1;
