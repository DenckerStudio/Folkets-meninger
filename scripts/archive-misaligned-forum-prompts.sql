-- Arkiver forum_prompts der spørsmål ikke stemmer med kildetitler
-- (f.eks. korrupsjonsspørsmål med kun svindel-mot-eldre-artikler).
-- Kjør manuelt i Supabase SQL Editor etter deploy av oppdatert n8n-workflow.

-- 1) Korrupsjon/offentlig sektor-spørsmål med eldre/svindel-kilder uten korrupsjon-dekning
UPDATE public.forum_prompts
SET status = 'archived'
WHERE status = 'active'
  AND question ~* 'korrupsjon|offentlig sektor|underslag'
  AND source_headlines::text ~* 'svindel|eldre|forsøk'
  AND source_headlines::text !~* 'korrupsjon|underslag|offentlig';

-- 2) Overskrift-mal («tydeligere grep om «…»») – skal aldri være active
UPDATE public.forum_prompts
SET status = 'archived'
WHERE status IN ('active', 'draft')
  AND (
    question ~* 'tydeligere grep om'
    OR question ~* 'ta tydeligere grep'
  );

-- 3) Valgfritt: arkiver etter kjent feil-URL (Aftenposten svindel mot eldre)
UPDATE public.forum_prompts
SET status = 'archived'
WHERE status = 'active'
  AND source_headlines::text ILIKE '%6qBJE8%'
  AND question ILIKE '%korrupsjon%offentlig%';

-- Verifiser før/etter:
-- SELECT id, question, source_headlines, status, created_at
-- FROM public.forum_prompts
-- WHERE question ILIKE '%korrupsjon%offentlig%'
--    OR source_headlines::text ILIKE '%6qBJE8%'
-- ORDER BY created_at DESC;
