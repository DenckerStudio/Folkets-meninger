-- Moderation feedback for forum prompts: learns from admin + AI decisions
CREATE TABLE IF NOT EXISTS public.forum_prompt_moderation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.forum_prompts (id) ON DELETE SET NULL,
  question text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('approved', 'rejected')),
  reason text,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'ai', 'auto')),
  topic_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_prompt_moderation_feedback_verdict_idx
  ON public.forum_prompt_moderation_feedback (verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS forum_prompt_moderation_feedback_question_idx
  ON public.forum_prompt_moderation_feedback (lower(trim(question)));

ALTER TABLE public.forum_prompt_moderation_feedback ENABLE ROW LEVEL SECURITY;

-- Service role / n8n only (no public read)
DROP POLICY IF EXISTS forum_prompt_moderation_feedback_service ON public.forum_prompt_moderation_feedback;
CREATE POLICY forum_prompt_moderation_feedback_service ON public.forum_prompt_moderation_feedback
  FOR ALL USING (false);

-- Log admin status changes as learning examples
CREATE OR REPLACE FUNCTION public.log_forum_prompt_moderation_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'active' AND OLD.status IN ('draft', 'archived') THEN
      INSERT INTO public.forum_prompt_moderation_feedback (prompt_id, question, verdict, reason, source, topic_tags)
      VALUES (NEW.id, NEW.question, 'approved', 'Aktivert av admin', 'admin', COALESCE(NEW.topic_tags, '{}'));
    ELSIF NEW.status = 'archived' AND OLD.status IN ('draft', 'active') THEN
      INSERT INTO public.forum_prompt_moderation_feedback (prompt_id, question, verdict, reason, source, topic_tags)
      VALUES (NEW.id, NEW.question, 'rejected', 'Arkivert av admin', 'admin', COALESCE(NEW.topic_tags, '{}'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_prompts_moderation_feedback_trg ON public.forum_prompts;
CREATE TRIGGER forum_prompts_moderation_feedback_trg
  AFTER UPDATE OF status ON public.forum_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_forum_prompt_moderation_feedback();

-- Seed from existing prompts (one-time bootstrap)
INSERT INTO public.forum_prompt_moderation_feedback (question, verdict, reason, source, topic_tags, created_at)
SELECT fp.question, 'approved', 'Historisk aktiv prompt', 'auto', COALESCE(fp.topic_tags, '{}'), fp.created_at
FROM public.forum_prompts fp
WHERE fp.status = 'active'
  AND trim(fp.question) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_prompt_moderation_feedback f
    WHERE lower(trim(f.question)) = lower(trim(fp.question)) AND f.verdict = 'approved'
  )
ORDER BY fp.created_at DESC
LIMIT 40;

INSERT INTO public.forum_prompt_moderation_feedback (question, verdict, reason, source, topic_tags, created_at)
SELECT fp.question, 'rejected', 'Historisk arkivert prompt', 'auto', COALESCE(fp.topic_tags, '{}'), fp.created_at
FROM public.forum_prompts fp
WHERE fp.status = 'archived'
  AND trim(fp.question) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_prompt_moderation_feedback f
    WHERE lower(trim(f.question)) = lower(trim(fp.question)) AND f.verdict = 'rejected'
  )
ORDER BY fp.created_at DESC
LIMIT 40;
