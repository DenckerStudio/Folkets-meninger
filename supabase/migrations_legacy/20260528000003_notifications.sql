-- In-app + email notifications (preferences, subscriptions, inbox)
-- Apply via Supabase SQL editor or: supabase db push

-- We rely on extensions.gen_random_uuid() from pgcrypto installed in earlier migrations.

-- Per-user notification preferences.
-- email_frequency_by_channel example:
-- {
--   "forum": "realtime",
--   "mentions": "realtime",
--   "categories": "daily"
-- }
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_frequency_by_channel jsonb NOT NULL DEFAULT jsonb_build_object(
    'forum', 'realtime',
    'mentions', 'realtime',
    'categories', 'daily'
  ),
  last_digest_sent_at_by_channel jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categories a user subscribes to (hjertesaker).
CREATE TABLE IF NOT EXISTS public.notification_category_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

-- Notification inbox items.
-- channel is the preference bucket (forum/mentions/categories/etc).
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  body text,
  url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  emailed_at timestamptz,
  email_last_error text
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_created_at
  ON public.notifications (channel, created_at DESC);

-- Keep updated_at current.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_category_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- notification_preferences: user manages their own.
DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_category_subscriptions: user manages their own.
DROP POLICY IF EXISTS notification_category_subscriptions_select_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_select_own
  ON public.notification_category_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_category_subscriptions_insert_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_insert_own
  ON public.notification_category_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_category_subscriptions_delete_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_delete_own
  ON public.notification_category_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- notifications inbox: user can read and mark read for their own.
-- Inserts are done via service_role (server) or via secured RPCs if added later.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_deny_inserts_from_clients ON public.notifications;
CREATE POLICY notifications_deny_inserts_from_clients
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS notifications_deny_deletes_from_clients ON public.notifications;
CREATE POLICY notifications_deny_deletes_from_clients
  ON public.notifications
  FOR DELETE TO authenticated
  USING (false);

