-- Personal share-link create/list (manual apply). Caller must be the session user.

CREATE UNIQUE INDEX IF NOT EXISTS share_links_active_target_uidx
  ON public.share_links (created_by, target_kind, target_id)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_share_link(
  p_user_id uuid,
  p_target_kind text,
  p_target_id text,
  p_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_target_id text;
  v_label text;
  v_existing public.share_links%ROWTYPE;
  v_code text;
  v_row public.share_links%ROWTYPE;
  v_attempt int;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);

  IF p_target_kind IS NULL OR p_target_kind NOT IN ('poll', 'blog_post', 'sak', 'generic') THEN
    RAISE EXCEPTION 'Ugyldig delingsmål'
      USING ERRCODE = '22023';
  END IF;

  v_target_id := btrim(COALESCE(p_target_id, ''));
  IF char_length(v_target_id) < 1
     OR char_length(v_target_id) > 200
     OR v_target_id = '.'
     OR position('..' IN v_target_id) > 0
     OR v_target_id !~ '^[A-Za-z0-9_.:-]{1,200}$' THEN
    RAISE EXCEPTION 'Ugyldig delingsmål'
      USING ERRCODE = '22023';
  END IF;

  v_label := NULLIF(btrim(COALESCE(p_label, '')), '');
  IF v_label IS NOT NULL THEN
    v_label := left(v_label, 80);
  END IF;

  SELECT *
  INTO v_existing
  FROM public.share_links
  WHERE created_by = p_user_id
    AND target_kind = p_target_kind
    AND target_id = v_target_id
    AND revoked_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'code', v_existing.code,
      'targetKind', v_existing.target_kind,
      'targetId', v_existing.target_id
    );
  END IF;

  FOR v_attempt IN 1..3 LOOP
    v_code := left(replace(gen_random_uuid()::text, '-', ''), 10);
    BEGIN
      INSERT INTO public.share_links (code, created_by, target_kind, target_id, label)
      VALUES (v_code, p_user_id, p_target_kind, v_target_id, v_label)
      RETURNING * INTO v_row;

      RETURN jsonb_build_object(
        'id', v_row.id,
        'code', v_row.code,
        'targetKind', v_row.target_kind,
        'targetId', v_row.target_id
      );
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO v_existing
        FROM public.share_links
        WHERE created_by = p_user_id
          AND target_kind = p_target_kind
          AND target_id = v_target_id
          AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
          RETURN jsonb_build_object(
            'id', v_existing.id,
            'code', v_existing.code,
            'targetKind', v_existing.target_kind,
            'targetId', v_existing.target_id
          );
        END IF;

        IF v_attempt = 3 THEN
          RAISE;
        END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'Kunne ikke lage delingslenke'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION public.create_share_link(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_share_link(uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_my_share_links(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sl.id,
        'code', sl.code,
        'target_kind', sl.target_kind,
        'target_id', sl.target_id,
        'label', sl.label,
        'created_at', sl.created_at
      )
      ORDER BY sl.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT id, code, target_kind, target_id, label, created_at
    FROM public.share_links
    WHERE created_by = p_user_id
      AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  ) sl;

  RETURN v_rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_share_links(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_share_links(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
