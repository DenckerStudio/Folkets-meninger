-- Forum base schema, enhancements, and trending prompts

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  stortinget_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  author_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  is_system_thread boolean NOT NULL DEFAULT false,
  context_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads (id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES public.forum_replies (id) ON DELETE SET NULL,
  is_official_response boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_likes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS is_system_thread boolean NOT NULL DEFAULT false;

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS context_items jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS forum_threads_created_at_idx ON public.forum_threads (created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_issue_idx ON public.forum_threads (stortinget_issue_id);
CREATE INDEX IF NOT EXISTS forum_replies_thread_idx ON public.forum_replies (thread_id);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_replies_select ON public.forum_replies;
CREATE POLICY forum_replies_select ON public.forum_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_likes_select ON public.forum_likes;
CREATE POLICY forum_likes_select ON public.forum_likes FOR SELECT USING (true);

-- System-spawnede tråder: author_user_id NULL + is_system_thread (ingen rad i auth.users)

-- forum_prompts
CREATE TABLE IF NOT EXISTS public.forum_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_headlines jsonb NOT NULL DEFAULT '[]'::jsonb,
  topic_tags text[] NOT NULL DEFAULT '{}',
  sensitivity text NOT NULL DEFAULT 'low' CHECK (sensitivity IN ('low', 'high')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sort_order int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  discuss_click_count int NOT NULL DEFAULT 0,
  discuss_threshold int NOT NULL DEFAULT 10,
  spawned_thread_id uuid REFERENCES public.forum_threads (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_prompt_votes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.forum_prompts (id) ON DELETE CASCADE,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS public.forum_prompt_discuss_clicks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.forum_prompts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS forum_prompts_status_idx ON public.forum_prompts (status, sort_order);
CREATE INDEX IF NOT EXISTS forum_prompts_expires_idx ON public.forum_prompts (expires_at);

ALTER TABLE public.forum_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_prompt_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_prompt_discuss_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_prompts_select ON public.forum_prompts;
CREATE POLICY forum_prompts_select ON public.forum_prompts
  FOR SELECT USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS forum_prompt_votes_select ON public.forum_prompt_votes;
CREATE POLICY forum_prompt_votes_select ON public.forum_prompt_votes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS forum_prompt_discuss_clicks_select ON public.forum_prompt_discuss_clicks;
CREATE POLICY forum_prompt_discuss_clicks_select ON public.forum_prompt_discuss_clicks
  FOR SELECT USING (auth.uid() = user_id);

-- Updated create_forum_thread with context_items
CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
BEGIN
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
  END IF;

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false)
  )
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cast_prompt_vote(
  p_user_id uuid,
  p_prompt_id uuid,
  p_option_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_option_exists boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_prompt FROM public.forum_prompts
  WHERE id = p_prompt_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found or inactive';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_prompt.options) opt
    WHERE opt->>'id' = p_option_id
  ) INTO v_option_exists;

  IF NOT v_option_exists THEN
    RAISE EXCEPTION 'Invalid option';
  END IF;

  INSERT INTO public.forum_prompt_votes (user_id, prompt_id, option_id)
  VALUES (p_user_id, p_prompt_id, p_option_id)
  ON CONFLICT (user_id, prompt_id) DO UPDATE SET option_id = EXCLUDED.option_id;

  RETURN public.get_prompt_results(p_prompt_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_prompt_results(p_prompt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_total int;
  v_results jsonb := '[]'::jsonb;
  v_opt record;
  v_count int;
BEGIN
  SELECT * INTO v_prompt FROM public.forum_prompts WHERE id = p_prompt_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT count(*) INTO v_total FROM public.forum_prompt_votes WHERE prompt_id = p_prompt_id;

  FOR v_opt IN SELECT value FROM jsonb_array_elements(v_prompt.options) AS t(value)
  LOOP
    SELECT count(*) INTO v_count
    FROM public.forum_prompt_votes
    WHERE prompt_id = p_prompt_id AND option_id = v_opt.value->>'id';

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_opt.value->>'id',
      'label', v_opt.value->>'label',
      'count', v_count,
      'percent', CASE WHEN v_total > 0 THEN round((v_count::numeric / v_total) * 100) ELSE 0 END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'options', v_results,
    'discuss_click_count', v_prompt.discuss_click_count,
    'discuss_threshold', v_prompt.discuss_threshold,
    'spawned_thread_id', v_prompt.spawned_thread_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_prompt_discuss_click(
  p_user_id uuid,
  p_prompt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_thread_id uuid;
  v_body text;
  v_results jsonb;
  v_headline jsonb;
  v_sources text := '';
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_prompt FROM public.forum_prompts
  WHERE id = p_prompt_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found';
  END IF;

  INSERT INTO public.forum_prompt_discuss_clicks (user_id, prompt_id)
  VALUES (p_user_id, p_prompt_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.forum_prompts
  SET discuss_click_count = (
    SELECT count(*) FROM public.forum_prompt_discuss_clicks WHERE prompt_id = p_prompt_id
  )
  WHERE id = p_prompt_id
  RETURNING * INTO v_prompt;

  IF v_prompt.spawned_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'click_count', v_prompt.discuss_click_count,
      'threshold', v_prompt.discuss_threshold,
      'spawned_thread_id', v_prompt.spawned_thread_id,
      'spawned', false
    );
  END IF;

  IF v_prompt.discuss_click_count >= v_prompt.discuss_threshold THEN
    v_results := public.get_prompt_results(p_prompt_id);

    FOR v_headline IN SELECT * FROM jsonb_array_elements(v_prompt.source_headlines)
    LOOP
      v_sources := v_sources || E'\n- ' || coalesce(v_headline->>'title', '') ||
        ' (' || coalesce(v_headline->>'outlet', 'kilde') || ')';
    END LOOP;

    v_body := 'Dette er en fellesdiskusjon startet etter at nok brukere ønsket å debattere dagens spørsmål.' ||
      E'\n\n**Spørsmål:** ' || v_prompt.question ||
      E'\n\n**Stemmeresultat:** ' || v_results::text ||
      E'\n\n**Kilder:**' || v_sources;

    v_thread_id := public.create_forum_thread(
      NULL,
      v_prompt.question,
      v_body,
      NULL,
      '[]'::jsonb,
      true
    );

    UPDATE public.forum_prompts
    SET spawned_thread_id = v_thread_id
    WHERE id = p_prompt_id;

    RETURN jsonb_build_object(
      'click_count', v_prompt.discuss_click_count,
      'threshold', v_prompt.discuss_threshold,
      'spawned_thread_id', v_thread_id,
      'spawned', true
    );
  END IF;

  RETURN jsonb_build_object(
    'click_count', v_prompt.discuss_click_count,
    'threshold', v_prompt.discuss_threshold,
    'spawned_thread_id', NULL,
    'spawned', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_prompt_vote(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_prompt_results(uuid) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_prompt_discuss_click(uuid, uuid) TO service_role;
