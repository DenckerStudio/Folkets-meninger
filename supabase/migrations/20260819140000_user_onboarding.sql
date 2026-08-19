-- User onboarding: name / SMS / BankID wizard + product tour completion.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at timestamptz;

COMMENT ON COLUMN public.users.onboarding_completed_at IS
  'When the user finished or skipped the post-signup onboarding wizard.';
COMMENT ON COLUMN public.users.onboarding_skipped IS
  'True when the user skipped remaining onboarding steps.';
COMMENT ON COLUMN public.users.onboarding_tour_completed_at IS
  'When the user finished or skipped the dashboard product tour.';

-- Existing named profiles should not be forced through the new wizard.
UPDATE public.users
SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL
  AND char_length(trim(coalesce(first_name, ''))) >= 2
  AND char_length(trim(coalesce(last_name, ''))) >= 2;

CREATE OR REPLACE FUNCTION public.set_user_onboarding_state(
  p_user_id uuid,
  p_completed boolean DEFAULT NULL,
  p_skipped boolean DEFAULT NULL,
  p_tour_completed boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    onboarding_completed_at = CASE
      WHEN p_completed IS TRUE THEN COALESCE(onboarding_completed_at, now())
      WHEN p_completed IS FALSE THEN NULL
      ELSE onboarding_completed_at
    END,
    onboarding_skipped = CASE
      WHEN p_skipped IS NULL THEN onboarding_skipped
      ELSE p_skipped
    END,
    onboarding_tour_completed_at = CASE
      WHEN p_tour_completed IS TRUE THEN COALESCE(onboarding_tour_completed_at, now())
      WHEN p_tour_completed IS FALSE THEN NULL
      ELSE onboarding_tour_completed_at
    END
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_user_onboarding_state(uuid, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_onboarding_state(uuid, boolean, boolean, boolean) TO service_role;
