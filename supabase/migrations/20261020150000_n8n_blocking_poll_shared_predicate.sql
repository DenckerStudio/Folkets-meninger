-- =============================================================================
-- Én felles «blokkerende poll»-predikat for n8n Reels-pipelinen.
--
-- Problem (N8N Expert, 19.10.2026): n8n_list_saks_without_blocking_poll returnerte
-- saker som allerede har poll (f.eks. 200429, 200419, 200421, 200063), og
-- n8n_blocking_poll_for_issue returnerte [] for de samme sakene, men
-- create_system_poll_draft feilet med HTTP 409. ~22 bortkastede utkast per kjøring.
--
-- Rotårsak: liste-/sjekk-funksjonene vurderte bare polls med status
-- draft/open/closed (og listen sammenlignet uten btrim), mens det som faktisk gir
-- 409 i PostgREST er SQLSTATE 23505 (unique_violation) fra den unike indeksen på
-- polls.stortinget_issue_id. RAISE EXCEPTION 'Poll already exists for issue' gir
-- P0001 = HTTP 400, ikke 409. En poll som status-filteret ikke ser (f.eks.
-- 'archived'), men som den unike indeksen i prod dekker, blokkerer dermed INSERT
-- uten at noen av sjekkene ser den.
--
-- Fiks: public.n8n_blocking_poll_id(text) er eneste kilde til sannhet. Den finner
-- (a) poll med status draft/open/closed, og (b) enhver poll som kolliderer med en
-- unik indeks på (stortinget_issue_id), med indeksens eget predikat lest fra
-- pg_index. Alle tre funksjonene bruker helperen, så de kan ikke drive fra
-- hverandre eller fra databasens faktiske unikhetsregel.
--
-- Kjøres via Coolify Expert ETTER 20261020140000 og 20261018160000.
-- Ingen skjema-/dataendringer; kun funksjonsdefinisjoner + grants.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. Felles helper ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_blocking_poll_id(p_issue_id text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue_id text := nullif(btrim(coalesce(p_issue_id, '')), '');
  v_poll_id uuid;
  v_pred text;
  v_attnum smallint;
BEGIN
  IF v_issue_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- (a) Kanonisk regel: aktiv poll (draft/open/closed) for saken.
  SELECT p.id INTO v_poll_id
  FROM public.polls p
  WHERE p.stortinget_issue_id = v_issue_id
    AND p.status IN ('draft', 'open', 'closed')
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_poll_id IS NOT NULL THEN
    RETURN v_poll_id;
  END IF;

  -- (b) Det INSERT faktisk kolliderer på: hver unik enkeltkolonne-indeks på
  --     polls(stortinget_issue_id), med indeksens eget (evt. partielle) predikat.
  SELECT a.attnum INTO v_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.polls'::regclass
    AND a.attname = 'stortinget_issue_id'
    AND NOT a.attisdropped;

  FOR v_pred IN
    SELECT pg_get_expr(ix.indpred, ix.indrelid)
    FROM pg_index ix
    WHERE ix.indrelid = 'public.polls'::regclass
      AND ix.indisunique
      AND ix.indnatts = 1
      AND ix.indkey[0] = v_attnum
      AND ix.indexprs IS NULL
  LOOP
    EXECUTE format(
      'SELECT p.id FROM public.polls p WHERE p.stortinget_issue_id = $1 AND (%s) ORDER BY p.created_at DESC LIMIT 1',
      coalesce(v_pred, 'true')
    )
    INTO v_poll_id
    USING v_issue_id;

    IF v_poll_id IS NOT NULL THEN
      RETURN v_poll_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.n8n_blocking_poll_id(text) IS
  'Eneste kilde til sannhet for «saken har blokkerende poll». Brukes av n8n_blocking_poll_for_issue, n8n_list_saks_without_blocking_poll og create_system_poll_draft.';

-- 2. Per-sak-sjekk ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_blocking_poll_for_issue(p_issue_id text)
RETURNS TABLE (id uuid, track text, status text, created_at timestamptz, stortinget_issue_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH b AS (SELECT public.n8n_blocking_poll_id(p_issue_id) AS poll_id)
  SELECT p.id, p.track, p.status, p.created_at, p.stortinget_issue_id
  FROM b
  JOIN public.polls p ON p.id = b.poll_id
  LIMIT 1;
$$;

-- 3. Kandidatliste ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_list_saks_without_blocking_poll(p_limit int DEFAULT 40, p_issue_id text DEFAULT NULL)
RETURNS TABLE (issue_id text, title text, summary text, category text, first_seen_at timestamptz, last_updated_at timestamptz, detail_json jsonb, documents json, ready_chunk_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH candidates AS MATERIALIZED (
    SELECT i.*
    FROM public.stortinget_issues i
    WHERE EXISTS (
        SELECT 1 FROM public.document_chunks dc
        WHERE dc.issue_id = i.id AND dc.embedding_status = 'ready' AND dc.embedding IS NOT NULL
      )
      AND (NULLIF(trim(coalesce(p_issue_id, '')), '') IS NULL OR i.id = NULLIF(trim(p_issue_id), ''))
  )
  SELECT i.id, i.title, i.summary, i.category, i.first_seen_at, i.last_updated_at, i.detail_json,
    (SELECT COALESCE(json_agg(json_build_object('document_id', d.document_id, 'title', d.title, 'document_type', d.document_type, 'source_url', d.source_url, 'fetched_at', d.fetched_at) ORDER BY d.fetched_at DESC), '[]'::json) FROM (SELECT document_id, title, document_type, source_url, fetched_at FROM public.stortinget_issue_documents WHERE issue_id = i.id ORDER BY fetched_at DESC LIMIT 6) d),
    (SELECT dc.id FROM public.document_chunks dc WHERE dc.issue_id = i.id AND dc.embedding_status = 'ready' AND dc.embedding IS NOT NULL LIMIT 1)
  FROM candidates i
  WHERE public.n8n_blocking_poll_id(i.id) IS NULL
  ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 40), 50));
$$;

-- 4. create_system_poll_draft: samme predikat + race-sikker INSERT ------------
CREATE OR REPLACE FUNCTION public.create_system_poll_draft(
  p_issue_id text,
  p_title text,
  p_neutral_summary text DEFAULT '',
  p_source_urls jsonb DEFAULT '[]'::jsonb,
  p_generation_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_poll_id uuid;
  v_title text;
  v_issue_id text := nullif(btrim(coalesce(p_issue_id, '')), '');
BEGIN
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Missing title';
  END IF;

  IF v_issue_id IS NOT NULL THEN
    INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
    VALUES (
      v_issue_id,
      v_title,
      nullif(btrim(coalesce(p_neutral_summary, '')), ''),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = now();

    v_poll_id := public.n8n_blocking_poll_id(v_issue_id);
    IF v_poll_id IS NOT NULL THEN
      RAISE EXCEPTION 'Poll already exists for issue'
        USING ERRCODE = 'unique_violation',
              DETAIL = format('issue_id=%s poll_id=%s', v_issue_id, v_poll_id);
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.polls (
      track,
      status,
      title,
      neutral_summary,
      source_urls,
      stortinget_issue_id,
      generation_metadata
    )
    VALUES (
      'system',
      'draft',
      v_title,
      coalesce(btrim(p_neutral_summary), ''),
      coalesce(p_source_urls, '[]'::jsonb),
      v_issue_id,
      coalesce(p_generation_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_poll_id;
  EXCEPTION WHEN unique_violation THEN
    -- Samtidig kjøring rakk å opprette poll mellom sjekk og INSERT.
    RAISE EXCEPTION 'Poll already exists for issue'
      USING ERRCODE = 'unique_violation',
            DETAIL = format('issue_id=%s (concurrent insert)', v_issue_id);
  END;

  RETURN v_poll_id;
END;
$$;

-- 5. Grants: service_role only (jf. 20261020140000) ----------------------------
REVOKE ALL ON FUNCTION public.n8n_blocking_poll_id(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_blocking_poll_for_issue(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_saks_without_blocking_poll(int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_system_poll_draft(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_blocking_poll_id(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_blocking_poll_for_issue(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_saks_without_blocking_poll(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_system_poll_draft(text, text, text, jsonb, jsonb) TO service_role;

-- 6. Assertion: ingen av funksjonene kjørbare for anon/authenticated
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN ('n8n_blocking_poll_id', 'n8n_blocking_poll_for_issue',
                      'n8n_list_saks_without_blocking_poll', 'create_system_poll_draft')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
         OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'blocking-poll grants feil: %', v_bad;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
