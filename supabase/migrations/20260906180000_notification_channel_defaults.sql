-- Drop legacy forum/mentions notification channels from defaults and stored preferences.

ALTER TABLE public.notification_preferences
  ALTER COLUMN email_frequency_by_channel SET DEFAULT jsonb_build_object(
    'categories', 'daily',
    'labels', 'daily'
  );

UPDATE public.notification_preferences
SET email_frequency_by_channel = (
  SELECT COALESCE(
    jsonb_object_agg(key, value),
    jsonb_build_object('categories', 'daily', 'labels', 'daily')
  )
  FROM jsonb_each_text(email_frequency_by_channel) AS e(key, value)
  WHERE key IN ('categories', 'labels')
)
WHERE email_frequency_by_channel ?| array['forum', 'mentions']
   OR NOT (email_frequency_by_channel ? 'categories')
   OR NOT (email_frequency_by_channel ? 'labels');

UPDATE public.notification_preferences
SET last_digest_sent_at_by_channel = (
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each_text(last_digest_sent_at_by_channel) AS e(key, value)
  WHERE key IN ('categories', 'labels')
)
WHERE last_digest_sent_at_by_channel ?| array['forum', 'mentions'];

COMMENT ON COLUMN public.notification_preferences.email_frequency_by_channel IS
  'Per-channel email cadence. Channels: categories (hjertesaker), labels (AI-emner).';
