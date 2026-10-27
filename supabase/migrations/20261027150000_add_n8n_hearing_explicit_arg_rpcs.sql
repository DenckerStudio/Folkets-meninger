-- Add PostgREST-friendly explicit-arg overloads for n8n hearing upserts (service_role only).
-- Legacy (jsonb) / p_payload wrappers from 20261022102000 stay until a follow-up migration drops them.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.n8n_upsert_stortinget_hearing(
  p_id text,
  p_sesjon text DEFAULT NULL,
  p_komite_id text DEFAULT NULL,
  p_komite_navn text DEFAULT NULL,
  p_tittel text DEFAULT NULL,
  p_tema text DEFAULT NULL,
  p_horing_status text DEFAULT NULL,
  p_status_kind text DEFAULT NULL,
  p_innspillsfrist timestamptz DEFAULT NULL,
  p_anmodningsfrist timestamptz DEFAULT NULL,
  p_soknadfrist timestamptz DEFAULT NULL,
  p_start_dato timestamptz DEFAULT NULL,
  p_skriftlig boolean DEFAULT false,
  p_skriftlig_innspill_url text DEFAULT NULL,
  p_related_issue_ids text[] DEFAULT '{}',
  p_detail_json jsonb DEFAULT '{}'::jsonb,
  p_last_synced_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text := btrim(coalesce(p_id, ''));
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
    nullif(btrim(coalesce(p_sesjon, '')), ''),
    nullif(btrim(coalesce(p_komite_id, '')), ''),
    nullif(btrim(coalesce(p_komite_navn, '')), ''),
    coalesce(nullif(btrim(coalesce(p_tittel, '')), ''), 'Høring'),
    nullif(btrim(coalesce(p_tema, '')), ''),
    nullif(btrim(coalesce(p_horing_status, '')), ''),
    nullif(btrim(coalesce(p_status_kind, '')), ''),
    p_innspillsfrist,
    p_anmodningsfrist,
    p_soknadfrist,
    p_start_dato,
    coalesce(p_skriftlig, false),
    coalesce(
      nullif(btrim(coalesce(p_skriftlig_innspill_url, '')), ''),
      'https://www.stortinget.no/no/Hva-skjer-pa-Stortinget/Horing/skriv-skriftlig-innspill/?h=' || v_id
    ),
    coalesce(p_related_issue_ids, '{}'::text[]),
    coalesce(p_detail_json, '{}'::jsonb),
    coalesce(p_last_synced_at, now()),
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

CREATE OR REPLACE FUNCTION public.n8n_upsert_hearing_document(
  p_hearing_id text,
  p_external_key text,
  p_title text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_source_url text DEFAULT NULL,
  p_markdown text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_error_message text DEFAULT NULL,
  p_content_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hearing_id text := btrim(coalesce(p_hearing_id, ''));
  v_external_key text := btrim(coalesce(p_external_key, ''));
  v_id uuid;
  v_status text := coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'pending');
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
    coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'Dokument'),
    coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'unknown'),
    nullif(btrim(coalesce(p_source_url, '')), ''),
    nullif(p_markdown, ''),
    v_status,
    nullif(btrim(coalesce(p_error_message, '')), ''),
    nullif(btrim(coalesce(p_content_hash, '')), ''),
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

REVOKE ALL ON FUNCTION public.n8n_upsert_stortinget_hearing(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, text, text[], jsonb, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_upsert_hearing_document(
  text, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_stortinget_hearing(
  text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz,
  boolean, text, text[], jsonb, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_hearing_document(
  text, text, text, text, text, text, text, text, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
