-- Expand user_llm_credentials.provider CHECK for first-class Stemme+ BYOK providers.
-- Keep existing values; add google, grok, ollama.
-- Coolify note: Mathias must apply this migration on supabase-folkets after merge.

ALTER TABLE public.user_llm_credentials
  DROP CONSTRAINT IF EXISTS user_llm_credentials_provider_check;

ALTER TABLE public.user_llm_credentials
  ADD CONSTRAINT user_llm_credentials_provider_check
  CHECK (
    provider IN (
      'openai',
      'anthropic',
      'openai_compatible',
      'ai_gateway',
      'google',
      'grok',
      'ollama'
    )
  );
