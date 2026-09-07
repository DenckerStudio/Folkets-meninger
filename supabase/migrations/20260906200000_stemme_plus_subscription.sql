-- Stemme+ supporter subscription tier (Stripe-backed when configured).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_subscription_tier_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'stemme_plus'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_uidx
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_uidx
  ON public.users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.users.subscription_tier IS
  'free | stemme_plus — supporter tier for badge, richer digest, and smarter alerts.';
COMMENT ON COLUMN public.users.stripe_customer_id IS
  'Stripe Customer id; set by checkout/webhook (service role only).';
COMMENT ON COLUMN public.users.stripe_subscription_id IS
  'Active Stripe Subscription id; cleared on cancel (service role only).';
COMMENT ON COLUMN public.users.subscription_status IS
  'Stripe subscription status mirror: active, trialing, past_due, canceled, etc.';
COMMENT ON COLUMN public.users.subscription_period_end IS
  'Current billing period end; access ends after this when canceled.';
