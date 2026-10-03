-- Session-scoped Stemme+ + BYOK reads for overlay chat.
-- Do not apply from this agent. Ciphertext stays encrypted at rest;
-- decrypt uses BYOK_ENCRYPTION_KEY on the server only.

GRANT SELECT (subscription_tier, subscription_status, subscription_period_end)
  ON public.users TO authenticated;

DROP POLICY IF EXISTS users_select_own_subscription ON public.users;
CREATE POLICY users_select_own_subscription
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_llm_credentials TO authenticated;

DROP POLICY IF EXISTS user_llm_credentials_select_own ON public.user_llm_credentials;
CREATE POLICY user_llm_credentials_select_own
  ON public.user_llm_credentials
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_llm_credentials_insert_own ON public.user_llm_credentials;
CREATE POLICY user_llm_credentials_insert_own
  ON public.user_llm_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_llm_credentials_update_own ON public.user_llm_credentials;
CREATE POLICY user_llm_credentials_update_own
  ON public.user_llm_credentials
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_llm_credentials_delete_own ON public.user_llm_credentials;
CREATE POLICY user_llm_credentials_delete_own
  ON public.user_llm_credentials
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_llm_credentials IS
  'Encrypted user BYOK LLM keys. The owning authenticated user may load ciphertext; decrypt only server-side with BYOK_ENCRYPTION_KEY. Never return the plaintext key to the browser.';
