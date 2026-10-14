-- Notification preferences v2 (varsel-preferanser).
-- NOT applied automatically. Apply manually after review.
--
-- Free users: server always uses free defaults for skip_finished, max_case_age_days,
-- enabled_types, only_followed, channel_email and frequency (weekly).
-- Stemme+ users can change them. Free users never get e-mail; their weekly digest is one in-app notification. channel_in_app / channel_push are open to everyone.
-- Existing RLS policies on notification_preferences (select/insert/update own row)
-- cover the new columns; tier rules are enforced in the API and at send time.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS skip_finished boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_case_age_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS enabled_types text[] NOT NULL
    DEFAULT ARRAY['new_case', 'reply_to_opinion', 'vote_open_close', 'hearing_deadline']::text[],
  ADD COLUMN IF NOT EXISTS only_followed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS channel_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS channel_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'weekly';

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_frequency_check;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_frequency_check
  CHECK (frequency IN ('realtime', 'daily', 'weekly'));

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_max_case_age_days_check;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_max_case_age_days_check
  CHECK (max_case_age_days BETWEEN 7 AND 365);

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_enabled_types_check;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_enabled_types_check
  CHECK (enabled_types <@ ARRAY['new_case', 'reply_to_opinion', 'vote_open_close', 'hearing_deadline']::text[]);

COMMENT ON COLUMN public.notification_preferences.skip_finished IS 'Stemme+: skip ferdigbehandlet cases (free: always true).';
COMMENT ON COLUMN public.notification_preferences.max_case_age_days IS 'Stemme+: skip cases older than N days, 7-365 (free: always 30).';
COMMENT ON COLUMN public.notification_preferences.enabled_types IS 'Stemme+: enabled notification types (free: all).';
COMMENT ON COLUMN public.notification_preferences.only_followed IS 'Stemme+: only followed themes, parties and cases.';
COMMENT ON COLUMN public.notification_preferences.channel_in_app IS 'Everyone: in-app channel.';
COMMENT ON COLUMN public.notification_preferences.channel_push IS 'Everyone: push channel.';
COMMENT ON COLUMN public.notification_preferences.channel_email IS 'Stemme+: e-mail channel (free: never e-mail).';
COMMENT ON COLUMN public.notification_preferences.frequency IS 'Stemme+: realtime | daily | weekly (free: weekly).';
